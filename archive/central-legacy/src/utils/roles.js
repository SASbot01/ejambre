// Multi-role helpers
// Roles are stored as comma-separated strings: "closer", "manager,closer", etc.

const ROLE_HIERARCHY = ['ceo', 'director', 'manager', 'closer', 'setter']

export function hasRole(roleStr, role) {
  return (roleStr || '').split(',').map(r => r.trim()).includes(role)
}

export function getRoles(roleStr) {
  return (roleStr || '').split(',').map(r => r.trim()).filter(Boolean)
}

export function getPrimaryRole(roleStr) {
  const roles = getRoles(roleStr)
  for (const r of ROLE_HIERARCHY) {
    if (roles.includes(r)) return r
  }
  return 'closer'
}

export function isGestorManager(member) {
  if (!member?.isGestor) return false
  const roles = getRoles(member.role)
  return roles.some(r => ['manager', 'director', 'ceo'].includes(r))
}
