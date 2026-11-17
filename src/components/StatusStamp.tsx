import { AlertTriangle, CheckCircle2, Clock, Eye, ShieldAlert } from 'lucide-react';
import type { TicketStatus } from '../types/civic';

interface StatusStampProps {
  status: TicketStatus;
  label: string;
}

export function StatusStamp({ status, label }: StatusStampProps) {
  if (status === 'escalated') {
    return (
      <span className="status-stamp status-stamp--escalated">
        <ShieldAlert size={13} strokeWidth={1.5} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'sla_risk') {
    return (
      <span className="status-stamp status-stamp--risk">
        <AlertTriangle size={13} strokeWidth={1.5} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'awaiting_audit') {
    return (
      <span className="status-stamp status-stamp--audit">
        <Eye size={13} strokeWidth={1.5} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'verified') {
    return (
      <span className="status-stamp status-stamp--verified">
        <CheckCircle2 size={13} strokeWidth={1.5} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="status-stamp status-stamp--open">
      <Clock size={13} strokeWidth={1.5} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
