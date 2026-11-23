export const DOCUMENTS = {
  'anvisa-pressure': 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-gvims-ggtes-anvisa-no-05-2023-praticas-de-seguranca-do-paciente-em-servicos-de-saude-prevencao-de-lesao-por-pressao/@@download/file',
  'cofen-787': 'https://www.cofen.gov.br/wp-content/uploads/2025/08/Resolucao-Cofen-no-787-2025-Regulamenta-a-atuacao-da-equipe-de-enfermagem-na-promocao-prevencao-tratamento-e-reabilitacao-de-pessoas-com-Lesoes-Cutaneas.pdf',
  'nice-sepsis': 'https://www.nice.org.uk/guidance/ng253/resources/suspected-sepsis-in-people-aged-16-or-over-recognition-assessment-and-early-management-pdf-66144015386053',
  'iwgdf-infection': 'https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-04-Infection-Guideline.pdf',
  'iwgdf-offloading': 'https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-06-Offloading-Guideline.pdf',
  'iwgdf-healing': 'https://iwgdfguidelines.org/wp-content/uploads/2023/07/IWGDF-2023-07-Wound-Healing-Guideline.pdf',
  'nice-pressure': 'https://www.nice.org.uk/guidance/cg179/resources/pressure-ulcers-prevention-and-management-pdf-35109760631749',
  'nice-surgery': 'https://www.nice.org.uk/guidance/ng125/resources/surgical-site-infectionsprevention-and-treatment-pdf-66141660564421',
  'nice-leg': 'https://www.nice.org.uk/guidance/ng152/resources/leg-ulcer-infection-antimicrobial-prescribing-pdf-9175139180485',
  'esvs-venous': 'https://www.sf-phlebologie.org/wp-content/uploads/2022/04/ESVS-2022-CVD-guidelines.pdf',
  'review-offloading': 'https://pure.amsterdamumc.nl/ws/portalfiles/portal/137322107/Effectiveness-of-offloading-interventions-for-people-with-diabetes-related-foot-ulcers.pdf',
  'trial-footwear': 'https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0219537&type=printable',
  'trial-venus': 'https://journals.plos.org/plosmedicine/article/file?id=10.1371%2Fjournal.pmed.1005154&type=printable',
};

export function pdfLink(ref) {
  if (!Object.hasOwn(DOCUMENTS, ref.document)) return null;
  const path = '/referencias/' + ref.document + '.pdf';
  return ref.page ? path + '#page=' + ref.page : path;
}
