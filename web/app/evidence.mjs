import { PROTOCOLS } from '../data/protocolos.mjs';
import { questionScope } from './domain.mjs';

export function guidanceFor(questionId, type, exam) {
  const scope = questionScope(type, exam);
  const available = PROTOCOLS.filter(ref =>
    (ref.type === scope || ref.type === 'general') && typeof ref.guidance?.[questionId] === 'string');
  const specific = available.find(ref => ref.type === scope);
  const reference = specific ?? available[0];
  return reference ? { reference, text: reference.guidance[questionId] } : null;
}
