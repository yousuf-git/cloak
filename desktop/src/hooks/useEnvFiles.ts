import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vaultApi, type EnvFileDto, type EnvTag } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { toBase64 } from '@/lib/base64';
import { useAppMode } from '@/stores/app-mode';
import { useSandboxData } from '@/stores/sandbox-data';

export interface DecryptResult {
  plaintext: string;
  publicKeyHex: string | null;
}

export function useEnvFiles(projectId?: string) {
  const sandbox = useAppMode((s) => s.sandbox);
  const qc = useQueryClient();
  const sb = useSandboxData();

  const query = useQuery({
    queryKey: ['env-files', projectId ?? 'all'],
    queryFn: () => vaultApi.listEnvFiles(projectId),
    enabled: !sandbox,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['env-files'] });

  if (sandbox) {
    const items = projectId
      ? sb.envFiles.filter((e) => e.project_id === projectId)
      : sb.envFiles;
    return {
      items: items as EnvFileDto[],
      isLoading: false,
      importPlain: async (pid: string, label: string, tag: EnvTag, plaintext: string) =>
        sb.addEnvFile({ project_id: pid, label, tag, plain: plaintext, hasKey: true }),
      importEncrypted: async (
        pid: string,
        label: string,
        tag: EnvTag,
        _content: string,
        privateKeyHex?: string,
      ) =>
        sb.addEnvFile({
          project_id: pid,
          label,
          tag,
          plain: '# decrypted preview unavailable in sandbox\n',
          hasKey: Boolean(privateKeyHex),
        }),
      getRaw: async (id: string) => sb.envFiles.find((e) => e._id === id)?.raw ?? '',
      decrypt: async (file: EnvFileDto): Promise<DecryptResult> => {
        const f = sb.envFiles.find((e) => e._id === file._id);
        return { plaintext: f?.plain ?? '', publicKeyHex: 'sandbox' };
      },
      saveEdit: async (file: EnvFileDto, plaintext: string, _publicKeyHex: string) =>
        sb.updateEnvFile(file._id, plaintext),
      remove: async (id: string) => sb.removeEnvFile(id),
    };
  }

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,

    importPlain: async (pid: string, label: string, tag: EnvTag, plaintext: string) => {
      const r = await crypto.envEncryptNew(plaintext);
      await vaultApi.createEnvFile({
        project_id: pid,
        label,
        tag,
        encrypted_dotenvx_key: r.wrapped_key_b64,
        content_b64: toBase64(r.encrypted_env),
        variable_count: r.variable_count,
      });
      await invalidate();
    },

    importEncrypted: async (
      pid: string,
      label: string,
      tag: EnvTag,
      content: string,
      privateKeyHex?: string,
    ) => {
      const wrapped = privateKeyHex ? await crypto.envWrapKey(privateKeyHex) : null;
      const variableCount = await crypto.envCountVariables(content);
      await vaultApi.createEnvFile({
        project_id: pid,
        label,
        tag,
        encrypted_dotenvx_key: wrapped,
        content_b64: toBase64(content),
        variable_count: variableCount,
      });
      await invalidate();
    },

    getRaw: async (id: string) => (await vaultApi.getEnvRaw(id)).content,

    decrypt: async (file: EnvFileDto): Promise<DecryptResult> => {
      if (!file.encrypted_dotenvx_key) {
        throw new Error('No decryption key stored for this file.');
      }
      const raw = (await vaultApi.getEnvRaw(file._id)).content;
      const r = await crypto.envDecrypt(raw, file.encrypted_dotenvx_key);
      return { plaintext: r.plaintext_env, publicKeyHex: r.public_key_hex };
    },

    saveEdit: async (file: EnvFileDto, plaintext: string, publicKeyHex: string) => {
      const r = await crypto.envEncryptExisting(plaintext, publicKeyHex);
      await vaultApi.updateEnvFile(file._id, {
        content_b64: toBase64(r.encrypted_env),
        variable_count: r.variable_count,
      });
      await invalidate();
    },

    remove: async (id: string) => {
      await vaultApi.deleteEnvFile(id);
      await invalidate();
    },
  };
}
