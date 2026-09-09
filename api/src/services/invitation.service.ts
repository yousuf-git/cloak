import { Types } from 'mongoose';
import { Invitation } from '../models/invitation.model.js';
import { Membership, type Role } from '../models/membership.model.js';
import { Org } from '../models/org.model.js';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import { generateOpaqueToken, sha256 } from '../lib/hashing.js';
import { encodeJoinKey } from '../lib/join-key.js';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../lib/errors.js';
import { sendInvitationEmail } from './email.service.js';

type Id = Types.ObjectId | string;

export interface InvitationView {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: Date;
  created_at: Date;
}

/**
 * What the inviting admin gets back. The join key is live credential material,
 * so it is returned exactly once, to the person who just minted it — never from
 * the listing endpoint, which only ever sees hashes.
 */
export interface CreatedInvitation extends InvitationView {
  join_key: string;
  /** False when Resend is unconfigured, so the UI can tell the admin to hand it over. */
  emailed: boolean;
}

function expiryDate(): Date {
  return new Date(Date.now() + config.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Invite someone by email. No key material is involved yet — the Org DEK can
 * only be sealed once the invitee has accepted and published a public key.
 */
export async function createInvitation(
  orgId: Id,
  invitedBy: Id,
  email: string,
  role: Role,
): Promise<CreatedInvitation> {
  if (role === 'owner') {
    throw new ValidationError('An organization has exactly one owner');
  }

  const existingUser = await User.findOne({ email }).select('_id').lean();
  if (existingUser) {
    const alreadyMember = await Membership.exists({ org_id: orgId, user_id: existingUser._id });
    if (alreadyMember) throw new ConflictError('That person is already in this organization');
  }

  const openInvite = await Invitation.findOne({ org_id: orgId, email, status: 'pending' });
  if (openInvite) throw new ConflictError('An invitation for that email is already pending');

  const token = generateOpaqueToken();
  const invitation = await Invitation.create({
    org_id: orgId,
    email,
    role,
    token_hash: sha256(token),
    invited_by: invitedBy,
    status: 'pending',
    expires_at: expiryDate(),
  });

  const org = await Org.findById(orgId).select('name').lean();
  const joinKey = encodeJoinKey(token);
  await sendInvitationEmail(email, org?.name ?? 'a Cloak organization', role, joinKey);

  return { ...toView(invitation), join_key: joinKey, emailed: config.mailConfigured };
}

export async function listInvitations(orgId: Id): Promise<InvitationView[]> {
  const rows = await Invitation.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
  return rows.map((r) => ({
    id: r._id.toString(),
    email: r.email,
    role: r.role,
    status: r.status,
    expires_at: r.expires_at,
    created_at: r.created_at,
  }));
}

export async function revokeInvitation(orgId: Id, invitationId: Id): Promise<void> {
  const result = await Invitation.updateOne(
    { _id: invitationId, org_id: orgId, status: 'pending' },
    { $set: { status: 'revoked' } },
  );
  if (result.matchedCount === 0) throw new NotFoundError('Invitation not found');
}

export interface InvitationPeek {
  org_name: string;
  role: Role;
  invited_by_email: string;
  expires_at: Date;
}

/** What the invitee sees before deciding to accept. */
export async function peekInvitation(token: string, email: string): Promise<InvitationPeek> {
  const invitation = await findUsable(token, email);
  const [org, inviter] = await Promise.all([
    Org.findById(invitation.org_id).select('name').lean(),
    User.findById(invitation.invited_by).select('email').lean(),
  ]);

  return {
    org_name: org?.name ?? 'Unknown organization',
    role: invitation.role,
    invited_by_email: inviter?.email ?? 'unknown',
    expires_at: invitation.expires_at,
  };
}

export interface AcceptResult {
  org_id: string;
  org_name: string;
  role: Role;
  /** Always 'pending_key': access begins when an admin seals the Org DEK. */
  status: 'pending_key';
}

/**
 * Accept an invitation. This creates a membership that cannot yet read
 * anything — the invitee has no copy of the Org DEK until someone who holds it
 * seals it to their public key.
 */
export async function acceptInvitation(token: string, userId: Id, email: string): Promise<AcceptResult> {
  const invitation = await findUsable(token, email);

  const user = await User.findById(userId).select('identity_public_key').lean();
  if (!user?.identity_public_key) {
    throw new ValidationError('Publish an identity public key before joining an organization');
  }

  const existing = await Membership.findOne({ org_id: invitation.org_id, user_id: userId });
  if (existing) throw new ConflictError('You are already in this organization');

  await Membership.create({
    org_id: invitation.org_id,
    user_id: userId,
    role: invitation.role,
    status: 'pending_key',
    invited_by: invitation.invited_by,
    // Carried over now: the invitation's TTL removes it once it expires.
    invited_at: invitation.created_at,
    joined_at: new Date(),
  });

  invitation.status = 'accepted';
  invitation.accepted_by = new Types.ObjectId(userId.toString());
  await invitation.save();

  const org = await Org.findById(invitation.org_id).select('name').lean();
  return {
    org_id: invitation.org_id.toString(),
    org_name: org?.name ?? 'Unknown organization',
    role: invitation.role,
    status: 'pending_key',
  };
}

/**
 * An invitation is addressed to one email. Binding it to the signed-in account
 * stops a leaked link from admitting whoever opens it.
 */
async function findUsable(token: string, email: string) {
  const invitation = await Invitation.findOne({ token_hash: sha256(token), status: 'pending' });
  if (!invitation || invitation.expires_at.getTime() < Date.now()) {
    throw new NotFoundError('Invitation');
  }
  if (invitation.email !== email.toLowerCase()) {
    throw new UnauthorizedError('This invitation was sent to a different email address');
  }
  return invitation;
}

function toView(invitation: {
  _id: Types.ObjectId;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: Date;
  created_at: Date;
}): InvitationView {
  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
  };
}
