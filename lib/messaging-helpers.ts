export function ensureGymBranding(template: string, gymName: string): string {
  const gym = gymName?.trim() || "tu gym";
  if (template.includes("{gym}") || template.includes("[Gym]")) {
    return template;
  }
  return `${template}\n\n— ${gym}`;
}
