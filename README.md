# LDO Consulta Pública 2026
Sistema web para coleta e análise de participações da Consulta Pública da LDO.

## Estrutura
```
ldo-consulta/
├── index.html       → Formulário de participação
├── dashboard.html   → Dashboard com gráficos
├── css/styles.css   → Estilos personalizados
├── js/firebase.js   → Inicialização do Firebase
├── js/form.js       → Lógica do formulário
└── js/dashboard.js  → Lógica do dashboard
```

## Regras do Firestore (cole no console Firebase)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /respostasLDO/{doc} {
      allow create: if true;
      allow read: if true;
      allow update, delete: if false;
    }
  }
}
```

## Como publicar
1. Copie todos os arquivos para um servidor web (Apache, Nginx, Vercel, Netlify, Firebase Hosting).
2. Os arquivos JS usam ES Modules — **não abra index.html diretamente pelo sistema de arquivos** (file://). Use um servidor local (ex: `npx serve .` ou extensão Live Server do VSCode).
3. Configure as regras do Firestore conforme acima.

## Tecnologias
- HTML5 + CSS3
- Bootstrap 5.3
- JavaScript ES Modules (sem bundler)
- Firebase Firestore v10
- Chart.js v4

## Funcionalidades
- Formulário responsivo com validação
- Limite de 5 prioridades por resposta
- Necessidades dinâmicas (até 5)
- Armazenamento no Firebase com timestamp
- Dashboard com gráficos de barras e radar
- Ranking de necessidades
- Filtros por bairro e zona
- Exportação CSV (com BOM para Excel)
