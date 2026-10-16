export type Category = 'IAM' | 'SRE' | 'DevOps' | 'Fullstack' | 'Cloud' | 'Backend' | 'Other';
export const CATEGORIES: Category[] = ['DevOps', 'Cloud', 'Backend', 'Fullstack', 'SRE', 'IAM', 'Other'];

// Order matters: more specific patterns first.
export function categorize(role: string): Category {
  const r = role.toLowerCase();
  if (/\biam\b|identity and access|m365/.test(r)) return 'IAM';
  if (/\bsre\b|site reliability/.test(r)) return 'SRE';
  if (/devops|devsecops|platform engineer|\bci\/cd\b|\bci\b|build system|infrastructure (engineer|developer)/.test(r)) return 'DevOps';
  if (/full[- ]?stack/.test(r)) return 'Fullstack';
  if (/cloud (engineer|architect|developer|software|specialist|expert)|iac developer/.test(r)) return 'Cloud';
  if (/backend|\.net|c#|systemutvecklare|software developer|software engineer|utvecklare/.test(r)) return 'Backend';
  return 'Other';
}
