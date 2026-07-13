import { GitBranch } from "lucide-react";
import { Section } from "@/components/ui/section";
import { ArchitectureFlow } from "@/components/sections/architecture-flow";

export function ArchitectureSection() {
  return (
    <Section
      id="architecture"
      label="Architecture"
      title="Cryptography on-device. Opaque storage in the cloud."
      description="Rust core handles all encryption. Express API verifies auth and stores blobs it cannot read."
      icon={<GitBranch className="h-4 w-4" />}
    >
      <ArchitectureFlow />
    </Section>
  );
}
