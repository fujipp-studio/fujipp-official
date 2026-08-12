export interface MilestoneRole {
  thresholdSatang: number;
  roleId: string;
}

export function topSpenderRolePolicy(
  slipRoleId: string,
  top1RoleId: string,
  top10RoleId: string,
  milestones: MilestoneRole[],
) {
  const allowed = (roleId: string) => roleId !== slipRoleId;
  const top1 = allowed(top1RoleId) ? top1RoleId : "";
  const top10 = allowed(top10RoleId) ? top10RoleId : "";
  const safeMilestones = milestones.filter((milestone) => allowed(milestone.roleId));
  const managed = [...new Set([top1, top10, ...safeMilestones.map((item) => item.roleId)].filter(Boolean))];

  return { top1, top10, milestones: safeMilestones, managed };
}
