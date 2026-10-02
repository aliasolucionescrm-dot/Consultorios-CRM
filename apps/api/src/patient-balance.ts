import {query,type Connection} from '../../../packages/database/src/client';
export async function patientPaid(org:string,patient:string,acceptance:string,c:Connection){
 const [row]=await query(`WITH RECURSIVE chain(id) AS (
 SELECT id FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 AND id=$3
 UNION SELECT t.from_acceptance_id FROM budget_credit_transfers t JOIN chain ON chain.id=t.to_acceptance_id WHERE t.organization_id=$1 AND t.patient_id=$2
 ) SELECT coalesce(sum(p.amount_minor-coalesce((SELECT sum(r.amount_minor) FROM patient_refunds r WHERE r.organization_id=p.organization_id AND r.payment_id=p.id),0)),0)::float8 AS total
 FROM patient_payments p JOIN chain ON chain.id=p.acceptance_id WHERE p.organization_id=$1 AND p.patient_id=$2 AND NOT EXISTS(SELECT 1 FROM payment_voids v WHERE v.organization_id=p.organization_id AND v.payment_id=p.id)`,[org,patient,acceptance],c);return row.total as number;
}
