import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vaultApi, type CredDto, type ApiKeyDto, type ProjectDto } from '@/lib/api';
import { useAppMode } from '@/stores/app-mode';
import { useSandboxData } from '@/stores/sandbox-data';

// ---------------- Credentials ----------------
export function useCreds() {
  const sandbox = useAppMode((s) => s.sandbox);
  const qc = useQueryClient();
  const sb = useSandboxData();

  const query = useQuery({
    queryKey: ['creds'],
    queryFn: vaultApi.listCreds,
    enabled: !sandbox,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['creds'] });

  if (sandbox) {
    return {
      items: sb.creds,
      isLoading: false,
      create: async (b: Partial<CredDto>) => sb.addCred(b),
      update: async (id: string, b: Partial<CredDto>) => sb.updateCred(id, b),
      remove: async (id: string) => sb.removeCred(id),
    };
  }

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    create: async (b: Partial<CredDto>) => {
      await vaultApi.createCred(b);
      await invalidate();
    },
    update: async (id: string, b: Partial<CredDto>) => {
      await vaultApi.updateCred(id, b);
      await invalidate();
    },
    remove: async (id: string) => {
      await vaultApi.deleteCred(id);
      await invalidate();
    },
  };
}

// ---------------- API Keys ----------------
export function useApiKeys() {
  const sandbox = useAppMode((s) => s.sandbox);
  const qc = useQueryClient();
  const sb = useSandboxData();

  const query = useQuery({
    queryKey: ['api-keys'],
    queryFn: vaultApi.listApiKeys,
    enabled: !sandbox,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['api-keys'] });

  if (sandbox) {
    return {
      items: sb.apiKeys,
      isLoading: false,
      create: async (b: Partial<ApiKeyDto>) => sb.addApiKey(b),
      update: async (id: string, b: Partial<ApiKeyDto>) => sb.updateApiKey(id, b),
      remove: async (id: string) => sb.removeApiKey(id),
    };
  }

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    create: async (b: Partial<ApiKeyDto>) => {
      await vaultApi.createApiKey(b);
      await invalidate();
    },
    update: async (id: string, b: Partial<ApiKeyDto>) => {
      await vaultApi.updateApiKey(id, b);
      await invalidate();
    },
    remove: async (id: string) => {
      await vaultApi.deleteApiKey(id);
      await invalidate();
    },
  };
}

// ---------------- Platforms (backup codes) ----------------
export function usePlatforms() {
  const sandbox = useAppMode((s) => s.sandbox);
  const qc = useQueryClient();
  const sb = useSandboxData();

  const query = useQuery({
    queryKey: ['platforms'],
    queryFn: vaultApi.listPlatforms,
    enabled: !sandbox,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['platforms'] });

  if (sandbox) {
    return {
      items: sb.platforms,
      isLoading: false,
      create: async (name: string, note: string | undefined, codes: string[]) =>
        sb.addPlatform(name, note, codes),
      remove: async (id: string) => sb.removePlatform(id),
      addCodes: async (id: string, codes: string[]) => sb.addCodes(id, codes),
      toggleCode: async (id: string, codeId: string, used: boolean) =>
        sb.toggleCode(id, codeId, used),
    };
  }

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    create: async (name: string, note: string | undefined, codes: string[]) => {
      await vaultApi.createPlatform({
        name,
        note,
        backup_codes: codes.map((c) => ({ encrypted_code: c })),
      });
      await invalidate();
    },
    remove: async (id: string) => {
      await vaultApi.deletePlatform(id);
      await invalidate();
    },
    addCodes: async (id: string, codes: string[]) => {
      await vaultApi.addBackupCodes(id, codes.map((c) => ({ encrypted_code: c })));
      await invalidate();
    },
    toggleCode: async (id: string, codeId: string, used: boolean) => {
      await vaultApi.setBackupCodeUsed(id, codeId, used);
      await invalidate();
    },
  };
}

// ---------------- Projects ----------------
export function useProjects() {
  const sandbox = useAppMode((s) => s.sandbox);
  const qc = useQueryClient();
  const sb = useSandboxData();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: vaultApi.listProjects,
    enabled: !sandbox,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] });

  if (sandbox) {
    return {
      items: sb.projects,
      isLoading: false,
      create: async (b: { name: string; url?: string; note?: string }) => sb.addProject(b),
      update: async (id: string, b: Partial<ProjectDto>) => sb.updateProject(id, b),
      remove: async (id: string) => sb.removeProject(id),
    };
  }

  // (real branch below returns the created project so callers can select it)

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    create: async (b: { name: string; url?: string; note?: string }) => {
      const project = await vaultApi.createProject(b);
      await invalidate();
      return project;
    },
    update: async (id: string, b: Partial<ProjectDto>) => {
      await vaultApi.updateProject(id, b);
      await invalidate();
    },
    remove: async (id: string) => {
      await vaultApi.deleteProject(id);
      await invalidate();
    },
  };
}
