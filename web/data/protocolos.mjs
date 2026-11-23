const anvisa = 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/notas-tecnicas/notas-tecnicas-vigentes/nota-tecnica-gvims-ggtes-anvisa-no-05-2023-praticas-de-seguranca-do-paciente-em-servicos-de-saude-prevencao-de-lesao-por-pressao/';
const iwgdf = 'https://doi.org/10.1093/cid/ciad527';
const niceLeg = 'https://www.nice.org.uk/guidance/ng152/chapter/recommendations';
const niceSurgical = 'https://www.nice.org.uk/guidance/ng125/chapter/recommendations';

export const PROTOCOLS = [
  {
    id: 'iwgdf-exame', type: 'diabetic', organization: 'IWGDF / IDSA', year: 2023,
    title: 'Infecção do pé relacionada ao diabetes', section: 'Recomendação 1 e tabela 1', url: iwgdf,
    text: 'O diagnóstico de infecção do pé relacionado ao diabetes é clínico. Considere sinais locais, como purulência, calor, dor, edema ou induração e eritema, e avalie causas alternativas de inflamação. A tabela 1 usa extensão do eritema, envolvimento profundo e critérios de resposta sistêmica para classificar a gravidade.',
    tags: ['secreção', 'vermelhidão', 'profundidade', 'SIRS', 'diabetes'],
  },
  {
    id: 'iwgdf-urgencia', type: 'diabetic', organization: 'IWGDF / IDSA', year: 2023,
    title: 'Infecção do pé relacionada ao diabetes', section: 'Recomendações 2 e 18, tabela 2', url: iwgdf,
    text: 'A diretriz recomenda avaliação cirúrgica urgente para infecção grave ou infecção moderada com complicações como gangrena extensa, sinais de abscesso profundo, infecção necrosante ou isquemia grave. A necessidade de hospitalização depende da gravidade e das comorbidades relevantes.',
    tags: ['sistêmico', 'urgência', 'piora', 'profundidade', 'necrose'],
  },
  {
    id: 'anvisa-estagios', type: 'pressure', organization: 'Anvisa', year: 2023,
    title: 'Prevenção de lesão por pressão', section: 'Nota técnica 05/2023, seção 1.1, p. 7–8', url: anvisa,
    text: 'O estadiamento pressupõe uma lesão por pressão identificada na avaliação clínica. Examina-se a integridade da pele, quais tecidos estão expostos, a presença de escara ou esfacelo que encobre a perda tissular e os sinais de dano tissular profundo.',
    tags: ['derme', 'tecido', 'estágio', 'pressão', 'profundidade'],
  },
  {
    id: 'anvisa-prevencao', type: 'pressure', organization: 'Anvisa', year: 2023,
    title: 'Prevenção de lesão por pressão', section: 'Nota técnica 05/2023, avaliação e prevenção', url: anvisa,
    text: 'A prevenção envolve avaliar o risco e inspecionar a pele, manejar a pressão e o cisalhamento e individualizar o reposicionamento e as superfícies de suporte.',
    tags: ['pressão', 'cisalhamento', 'reposicionamento', 'pele'],
  },
  {
    id: 'nice-incisao', type: 'surgical', organization: 'NICE', year: 2019,
    title: 'Infecção de sítio cirúrgico', section: 'NG125, seção 1.4 e definições', url: niceSurgical,
    text: 'A infecção de sítio cirúrgico pode apresentar calor, eritema, dor e edema ao redor da incisão, com manifestações sistêmicas em casos mais graves. A avaliação deve considerar profundidade, contexto pós-operatório e os achados ao redor da ferida.',
    tags: ['incisão', 'cirurgia', 'secreção', 'calor', 'sistêmico'],
  },
  {
    id: 'nice-ulcera', type: 'venous', organization: 'NICE', year: 2020,
    title: 'Infecção de úlcera de perna', section: 'NG152, itens 1.1.1–1.1.3', url: niceLeg,
    text: 'Uma úlcera de perna pode estar colonizada. A avaliação de infecção considera sinais clínicos, como eritema ou edema que se estende além da úlcera, calor localizado, dor crescente ou febre. O manejo deve considerar a causa de base da úlcera.',
    tags: ['venosa', 'eritema', 'edema', 'calor', 'úlcera'],
  },
  {
    id: 'nice-ulcera-urgencia', type: 'venous', organization: 'NICE', year: 2020,
    title: 'Infecção de úlcera de perna', section: 'NG152, itens 1.1.8–1.1.13', url: niceLeg,
    text: 'Reavalie em caso de piora rápida, comprometimento sistêmico ou dor intensa desproporcional. Suspeita de sepse, fasciíte necrosante ou osteomielite é motivo de avaliação hospitalar.',
    tags: ['venosa', 'urgência', 'piora', 'sistêmico', 'dor'],
  },
];
