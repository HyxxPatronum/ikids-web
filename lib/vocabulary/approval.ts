export type ApprovalStatus = 'candidate' | 'approved' | 'rejected' | 'published';

export type ApprovalFields = {
  approved?: boolean;
  approvalStatus?: ApprovalStatus;
  status?: ApprovalStatus;
};

export function isApprovedTerm(term: ApprovalFields) {
  if (term.approved === false) return false;
  if (term.approved === true) return true;
  return term.approvalStatus === 'approved' || term.status === 'approved' || term.status === 'published';
}
