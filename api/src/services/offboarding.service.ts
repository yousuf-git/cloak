import { Types } from 'mongoose';
import { Cred } from '../models/cred.model.js';
import { ApiKey } from '../models/api-key.model.js';
import { AccessKey } from '../models/access-key.model.js';
import { SshKey } from '../models/ssh-key.model.js';
import { Platform } from '../models/platform.model.js';
import { EnvFile } from '../models/env-file.model.js';
import { Project } from '../models/project.model.js';
import { Membership } from '../models/membership.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { User } from '../models/user.model.js';
import { NotFoundError } from '../lib/errors.js';
import type { Role } from '../models/membership.model.js';

type Id = Types.ObjectId | string;

export type ExposedKind = 'cred' | 'api_key' | 'access_key' | 'ssh_key' | 'platform' | 'env_file';

export interface ExposedItem {
  kind: ExposedKind;
  id: string;
  label: string;
  project?: string;
  /** The trail shows this member opened or changed this one, not merely that they could. */
  opened: boolean;
}

export interface MemberExposure {
  member: { user_id: string; email?: string; role: Role; joined_at?: Date; granted_at?: Date };
  items: ExposedItem[];
  counts: Record<ExposedKind, number>;
  opened_count: number;
  /** More secrets exist than are listed; the listing is capped. */
  truncated: boolean;
}

/** Enough to work through by hand without the dialog turning into a scroll. */
const MAX_ITEMS = 300;

/**
 * What a member could read, for the admin removing them.
 *
 * A member holds the organization's key, so the honest answer is "everything in
 * the organization" — this lists it by name so the admin can work through it at
 * the providers that issued the secrets. Entries the trail shows they actually
 * opened are marked, because those are the ones to deal with first.
 */
export async function getMemberExposure(orgId: Id, userId: Id): Promise<MemberExposure> {
  const membership = await Membership.findOne({ org_id: orgId, user_id: userId }).lean();
  if (!membership) throw new NotFoundError('Member not found');

  const [user, projects, creds, apiKeys, accessKeys, sshKeys, platforms, envFiles, opened] =
    await Promise.all([
      User.findById(userId).select('email').lean(),
      Project.find({ org_id: orgId }).select('name').lean(),
      Cred.find({ org_id: orgId }).select('name project_id').lean(),
      ApiKey.find({ org_id: orgId }).select('label project_id').lean(),
      AccessKey.find({ org_id: orgId }).select('title project_id').lean(),
      SshKey.find({ org_id: orgId }).select('title project_id').lean(),
      Platform.find({ org_id: orgId }).select('name project_id').lean(),
      EnvFile.find({ org_id: orgId }).select('label project_id').lean(),
      AuditLog.distinct('resource_id', { org_id: orgId, user_id: userId }),
    ]);

  const projectName = new Map(projects.map((p) => [p._id.toString(), p.name]));
  const touched = new Set(opened.filter((id): id is string => typeof id === 'string'));

  const toItem = (
    kind: ExposedKind,
    doc: { _id: Types.ObjectId; project_id?: Types.ObjectId },
    label: string,
  ): ExposedItem => ({
    kind,
    id: doc._id.toString(),
    label,
    project: doc.project_id ? projectName.get(doc.project_id.toString()) : undefined,
    opened: touched.has(doc._id.toString()),
  });

  const items: ExposedItem[] = [
    ...creds.map((d) => toItem('cred', d, d.name)),
    ...apiKeys.map((d) => toItem('api_key', d, d.label)),
    ...accessKeys.map((d) => toItem('access_key', d, d.title)),
    ...sshKeys.map((d) => toItem('ssh_key', d, d.title)),
    ...platforms.map((d) => toItem('platform', d, d.name)),
    ...envFiles.map((d) => toItem('env_file', d, d.label)),
  ];

  // Anything they demonstrably opened comes first — that is where to start.
  items.sort((a, b) => Number(b.opened) - Number(a.opened) || a.label.localeCompare(b.label));

  return {
    member: {
      user_id: membership.user_id.toString(),
      email: user?.email,
      role: membership.role,
      joined_at: membership.joined_at,
      granted_at: membership.granted_at,
    },
    items: items.slice(0, MAX_ITEMS),
    counts: {
      cred: creds.length,
      api_key: apiKeys.length,
      access_key: accessKeys.length,
      ssh_key: sshKeys.length,
      platform: platforms.length,
      env_file: envFiles.length,
    },
    opened_count: items.filter((i) => i.opened).length,
    truncated: items.length > MAX_ITEMS,
  };
}
