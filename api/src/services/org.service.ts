import { Types } from 'mongoose';
import { Org } from '../models/org.model.js';
import { Membership, type MembershipStatus, type Role } from '../models/membership.model.js';
import { User } from '../models/user.model.js';
import { Cred } from '../models/cred.model.js';
import { ApiKey } from '../models/api-key.model.js';
import { AccessKey } from '../models/access-key.model.js';
import { SshKey } from '../models/ssh-key.model.js';
import { Platform } from '../models/platform.model.js';
import { EnvFile } from '../models/env-file.model.js';
import { Project } from '../models/project.model.js';
import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { outranks } from '../lib/permissions.js';

type Id = Types.ObjectId | string;

export interface CreateOrgInput {
  name: string;
  /** Org DEK sealed to the creator's own identity public key. */
  wrapped_org_dek: string;
  org_recovery_salt: string;
  org_recovery_wrappedDEK: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  role: Role;
  /** 'pending_key' until a member with the key seals it to this user. */
  status: MembershipStatus;
  is_owner: boolean;
  /** Empty while pending — the wrap does not exist until someone grants it. */
  wrapped_org_dek: string;
  member_count: number;
  created_at: Date;
}

/**
 * Create an org and make the caller its owner. The Org DEK arrives already
 * sealed to the caller's public key — the server never holds it in the clear.
 */
export async function createOrg(userId: Id, input: CreateOrgInput): Promise<OrgSummary> {
  const user = await User.findById(userId).select('identity_public_key');
  if (!user?.identity_public_key) {
    throw new ValidationError('Publish an identity public key before creating an organization');
  }

  const org = await Org.create({
    name: input.name,
    owner_id: userId,
    org_recovery_salt: input.org_recovery_salt,
    org_recovery_wrappedDEK: input.org_recovery_wrappedDEK,
  });

  await Membership.create({
    org_id: org._id,
    user_id: userId,
    role: 'owner',
    status: 'active',
    wrapped_org_dek: input.wrapped_org_dek,
    joined_at: new Date(),
  });

  return {
    id: org._id.toString(),
    name: org.name,
    role: 'owner',
    status: 'active',
    is_owner: true,
    wrapped_org_dek: input.wrapped_org_dek,
    member_count: 1,
    created_at: org.created_at,
  };
}

/**
 * Every org the user belongs to, with their own sealed copy of the key.
 * Includes memberships still awaiting a key grant so the client can show them
 * as pending rather than silently omitting an org the user has already joined.
 */
export async function listOrgsForUser(userId: Id): Promise<OrgSummary[]> {
  const memberships = await Membership.find({
    user_id: userId,
    status: { $in: ['active', 'pending_key'] },
  })
    .populate<{ org_id: { _id: Types.ObjectId; name: string; owner_id: Types.ObjectId; created_at: Date } }>(
      'org_id',
      'name owner_id created_at',
    )
    .lean();

  const counts = await Membership.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { org_id: { $in: memberships.map((m) => m.org_id._id) }, status: 'active' } },
    { $group: { _id: '$org_id', count: { $sum: 1 } } },
  ]);
  const countByOrg = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return memberships.map((m) => ({
    id: m.org_id._id.toString(),
    name: m.org_id.name,
    role: m.role,
    status: m.status,
    is_owner: m.org_id.owner_id.toString() === userId.toString(),
    wrapped_org_dek: m.wrapped_org_dek ?? '',
    member_count: countByOrg.get(m.org_id._id.toString()) ?? 1,
    created_at: m.org_id.created_at,
  }));
}

/** The actor-facing name of a member, for the audit trail. */
async function userEmail(userId: Id): Promise<string | undefined> {
  const user = await User.findById(userId).select('email').lean();
  return user?.email;
}

export async function orgName(orgId: Id): Promise<string | undefined> {
  const org = await Org.findById(orgId).select('name').lean();
  return org?.name;
}

export async function renameOrg(orgId: Id, name: string): Promise<{ id: string; name: string }> {
  const org = await Org.findByIdAndUpdate(orgId, { $set: { name } }, { new: true });
  if (!org) throw new NotFoundError('Organization not found');
  return { id: org._id.toString(), name: org.name };
}

/**
 * Delete an org and everything in it. Refuses to strand the caller: an account
 * must always have somewhere to keep its secrets.
 */
export async function deleteOrg(orgId: Id, userId: Id): Promise<{ name?: string; destroyed: number; members: number }> {
  const remaining = await Membership.countDocuments({
    user_id: userId,
    status: 'active',
    org_id: { $ne: orgId },
  });
  if (remaining === 0) {
    throw new ConflictError('This is your only organization — create another before deleting it');
  }

  const name = await orgName(orgId);
  const [creds, apiKeys, accessKeys, sshKeys, platforms, envFiles, projects, , memberships] =
    await Promise.all([
      Cred.deleteMany({ org_id: orgId }),
      ApiKey.deleteMany({ org_id: orgId }),
      AccessKey.deleteMany({ org_id: orgId }),
      SshKey.deleteMany({ org_id: orgId }),
      Platform.deleteMany({ org_id: orgId }),
      EnvFile.deleteMany({ org_id: orgId }),
      Project.deleteMany({ org_id: orgId }),
      Invitation.deleteMany({ org_id: orgId }),
      Membership.deleteMany({ org_id: orgId }),
    ]);
  await Org.deleteOne({ _id: orgId });

  return {
    name,
    destroyed:
      creds.deletedCount +
      apiKeys.deletedCount +
      accessKeys.deletedCount +
      sshKeys.deletedCount +
      platforms.deletedCount +
      envFiles.deletedCount +
      projects.deletedCount,
    members: memberships.deletedCount,
  };
}

/** Hand ownership to another active member; the old owner stays on as admin. */
export async function transferOwnership(
  orgId: Id,
  currentOwnerId: Id,
  newOwnerId: Id,
): Promise<{ email?: string }> {
  if (currentOwnerId.toString() === newOwnerId.toString()) {
    throw new ValidationError('You already own this organization');
  }

  const target = await Membership.findOne({ org_id: orgId, user_id: newOwnerId, status: 'active' });
  if (!target) throw new NotFoundError('Member not found');

  await Org.updateOne({ _id: orgId }, { $set: { owner_id: newOwnerId } });
  await Membership.updateOne({ org_id: orgId, user_id: newOwnerId }, { $set: { role: 'owner' } });
  await Membership.updateOne({ org_id: orgId, user_id: currentOwnerId }, { $set: { role: 'admin' } });

  return { email: await userEmail(newOwnerId) };
}

/** The break-glass envelope. Only the owner may fetch it. */
export async function getRecoveryEnvelope(
  orgId: Id,
): Promise<{ org_recovery_salt: string; org_recovery_wrappedDEK: string }> {
  const org = await Org.findById(orgId).select('org_recovery_salt org_recovery_wrappedDEK').lean();
  if (!org) throw new NotFoundError('Organization not found');
  return {
    org_recovery_salt: org.org_recovery_salt,
    org_recovery_wrappedDEK: org.org_recovery_wrappedDEK,
  };
}

/**
 * Restore the owner's own access after a break-glass unlock: the client has
 * re-sealed the Org DEK to its identity key and hands back the new wrap.
 */
export async function restoreOwnerAccess(
  orgId: Id,
  userId: Id,
  wrappedOrgDek: string,
): Promise<void> {
  const org = await Org.findById(orgId).select('owner_id').lean();
  if (!org) throw new NotFoundError('Organization not found');
  if (org.owner_id.toString() !== userId.toString()) {
    throw new ForbiddenError('Only the owner can perform break-glass recovery');
  }

  await Membership.updateOne(
    { org_id: orgId, user_id: userId },
    {
      $set: { wrapped_org_dek: wrappedOrgDek, role: 'owner', status: 'active' },
      // Break-glass restores access the owner already had; it is not a new join,
      // so the original joined_at must survive it.
      $setOnInsert: { org_id: orgId, user_id: userId, joined_at: new Date() },
    },
    { upsert: true },
  );
}

export interface MemberView {
  user_id: string;
  email: string;
  name?: string;
  role: Role;
  status: 'pending_key' | 'active';
  identity_public_key?: string;
  joined_at?: Date;
}

type PopulatedUser = {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  identity_public_key?: string;
};

export async function listMembers(orgId: Id, status?: 'pending_key' | 'active'): Promise<MemberView[]> {
  const filter: Record<string, unknown> = { org_id: orgId };
  if (status) filter.status = status;

  const rows = await Membership.find(filter)
    .populate<{ user_id: PopulatedUser }>('user_id', 'email name identity_public_key')
    .sort({ created_at: 1 })
    .lean();

  return rows.map((m) => ({
    user_id: m.user_id._id.toString(),
    email: m.user_id.email,
    name: m.user_id.name,
    role: m.role,
    status: m.status,
    identity_public_key: m.user_id.identity_public_key,
    joined_at: m.joined_at,
  }));
}

export interface MemberDetail extends MemberView {
  invited_by?: { user_id: string; email: string; name?: string };
  granted_by?: { user_id: string; email: string; name?: string };
  invited_at?: Date;
  granted_at?: Date;
  /** Timestamp of this member's most recent audited action in this org. */
  last_activity_at?: Date;
  created_at: Date;
}

/**
 * One member, with the people who let them in and when they were last active.
 * Backs the per-member page reached from the team list.
 */
export async function getMemberDetail(orgId: Id, targetUserId: Id): Promise<MemberDetail> {
  const membership = await Membership.findOne({ org_id: orgId, user_id: targetUserId })
    .populate<{ user_id: PopulatedUser }>('user_id', 'email name identity_public_key')
    .lean();
  if (!membership) throw new NotFoundError('Member not found');

  const referees = [membership.invited_by, membership.granted_by].filter(
    (id): id is Types.ObjectId => Boolean(id),
  );
  const [people, lastEntry] = await Promise.all([
    referees.length > 0
      ? User.find({ _id: { $in: referees } }).select('email name').lean()
      : Promise.resolve([]),
    AuditLog.findOne({ org_id: orgId, user_id: targetUserId }).sort({ created_at: -1 }).lean(),
  ]);
  const byId = new Map(
    people.map((u) => [u._id.toString(), { user_id: u._id.toString(), email: u.email, name: u.name }]),
  );

  return {
    user_id: membership.user_id._id.toString(),
    email: membership.user_id.email,
    name: membership.user_id.name,
    role: membership.role,
    status: membership.status,
    identity_public_key: membership.user_id.identity_public_key,
    joined_at: membership.joined_at,
    invited_by: membership.invited_by ? byId.get(membership.invited_by.toString()) : undefined,
    granted_by: membership.granted_by ? byId.get(membership.granted_by.toString()) : undefined,
    invited_at: membership.invited_at,
    granted_at: membership.granted_at,
    last_activity_at: lastEntry?.created_at,
    created_at: membership.created_at,
  };
}

/**
 * Complete a join: an existing member seals the Org DEK to the newcomer's
 * public key and uploads the result. Neither the server nor the newcomer can do
 * this, which is why joining takes two steps.
 */
export async function grantMemberKey(
  orgId: Id,
  targetUserId: Id,
  wrappedOrgDek: string,
  grantedBy: Id,
): Promise<{ email?: string; role: Role }> {
  const membership = await Membership.findOne({ org_id: orgId, user_id: targetUserId });
  if (!membership) throw new NotFoundError('Member not found');
  if (membership.status === 'active') {
    throw new ConflictError('That member already has access');
  }

  membership.granted_by = new Types.ObjectId(grantedBy.toString());
  membership.wrapped_org_dek = wrappedOrgDek;
  membership.status = 'active';
  // joined_at belongs to the accept, which already happened — only the grant
  // is new here.
  membership.granted_at = new Date();
  await membership.save();

  return { email: await userEmail(targetUserId), role: membership.role };
}

export async function changeRole(
  orgId: Id,
  actorRole: Role,
  targetUserId: Id,
  role: Role,
): Promise<{ email?: string; from: Role; to: Role }> {
  if (role === 'owner') {
    throw new ValidationError('Use ownership transfer to make someone the owner');
  }

  const membership = await Membership.findOne({ org_id: orgId, user_id: targetUserId });
  if (!membership) throw new NotFoundError('Member not found');
  if (!outranks(actorRole, membership.role)) {
    throw new ForbiddenError('You cannot change the role of a member at or above your own level');
  }

  const previous = membership.role;
  membership.role = role;
  await membership.save();

  return { email: await userEmail(targetUserId), from: previous, to: role };
}

/**
 * Remove a member.
 *
 * Deleting the membership row is the whole operation: requireOrg resolves the
 * caller's membership on every request, so access ends on the next one. The
 * member's sessions are deliberately left alone — they are account-wide, not
 * org-wide, and ending them would sign the person out of organizations this
 * removal has nothing to do with.
 *
 * This revokes server-side access only: the Org DEK is not rotated, so anyone
 * who already held it keeps the ability to decrypt ciphertext they copied
 * beforehand. See "Deferred: Org DEK rotation on offboarding" in
 * docs/TEAMS_ARCHITECTURE.md.
 */
export async function removeMember(
  orgId: Id,
  actorRole: Role,
  targetUserId: Id,
): Promise<{ email?: string; role: Role }> {
  const membership = await Membership.findOne({ org_id: orgId, user_id: targetUserId });
  if (!membership) throw new NotFoundError('Member not found');
  if (membership.role === 'owner') {
    throw new ForbiddenError('Transfer ownership before removing the owner');
  }
  if (!outranks(actorRole, membership.role)) {
    throw new ForbiddenError('You cannot remove a member at or above your own level');
  }

  await Membership.deleteOne({ _id: membership._id });

  return { email: await userEmail(targetUserId), role: membership.role };
}
