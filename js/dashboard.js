/**
 * dashboard.js – Consulta Pública LDO 2026
 * Prefeitura Municipal de Oriximiná
 *
 * Visão geral completa:
 * - 8 cards de estatísticas gerais
 * - Gráficos de perfil: sexo, zona, perfil, faixa etária, bairros
 * - Prioridades mais votadas + ranking de necessidades
 * - Avaliações: radar + barras empilhadas + tabela detalhada
 * - Engajamento: participou / acha importante / quer receber info
 * - Últimas sugestões e observações textuais
 * - Filtros por bairro, zona, sexo e perfil
 * - Exportação CSV completa
 */

const PALETA_BARRAS = [
  "#3b82f6", // azul
  "#22c55e", // verde
  "#f59e0b", // amarelo
  "#ef4444", // vermelho
  "#8b5cf6", // roxo
  "#06b6d4", // ciano
  "#f97316", // laranja
  "#10b981", // verde claro
];

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Estado ──────────────────────────────────────────────────
let todasRespostas = [];

// Instâncias dos gráficos (para destruir antes de recriar)
const charts = {};

// ─── Paletas ─────────────────────────────────────────────────
const COR_VERDE = "rgba(26,107,60,0.85)";
const COR_AMARELO = "rgba(245,197,24,0.85)";
const PALETA_PIE = [
  "#3b82f6", // azul
  "#ef4444", // vermelho
  "#f59e0b", // amarelo
  "#8b5cf6", // roxo
  "#06b6d4", // ciano
  "#f97316", // laranja
];
const PALETA_AVAL = {
  pessimo: "#ef4444",
  ruim: "#f97316",
  regular: "#eab308",
  bom: "#22c55e",
  otimo: "#1a6b3c",
};

// ─── Mapeamentos ─────────────────────────────────────────────
const LABELS_PRI = {
  saude: "Saúde",
  educacao: "Educação",
  seguranca: "Segurança Pública",
  infraestrutura: "Infraestrutura",
  pavimentacao: "Pavimentação",
  iluminacao: "Iluminação Pública",
  limpeza: "Limpeza Urbana",
  saneamento: "Saneamento Básico",
  agua: "Abast. de Água",
  habitacao: "Habitação",
  meio_ambiente: "Meio Ambiente",
  agricultura: "Agricultura",
  emprego: "Emprego e Renda",
  turismo: "Turismo",
  cultura: "Cultura",
  esporte: "Esporte e Lazer",
  assistencia: "Assistência Social",
  transporte: "Transporte",
  mobilidade: "Mobilidade Urbana",
  inclusao_digital: "Inclusão Digital",
  juventude: "Juventude",
  mulher: "Atend. à Mulher",
  idosos: "Pol. para Idosos",
  pcd: "Pessoas c/ Defic.",
};

const AREAS_AVAL = [
  "saude",
  "educacao",
  "limpeza",
  "iluminacao",
  "transporte",
  "seguranca",
  "infraestrutura",
  "assistencia",
];
const LABELS_AVAL = [
  "Saúde",
  "Educação",
  "Limpeza",
  "Iluminação",
  "Transporte",
  "Segurança",
  "Infraestrutura",
  "Assist. Social",
];
const NOTAS = ["pessimo", "ruim", "regular", "bom", "otimo"];
const NOTAS_LABEL = ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"];
const AVAL_NUM = { pessimo: 1, ruim: 2, regular: 3, bom: 4, otimo: 5 };

// ─── Carga de dados ───────────────────────────────────────────
async function carregarDados() {
  mostrarLoading(true);
  try {
    const q = query(
      collection(db, "respostasLDO"),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    todasRespostas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    popularFiltros();
    renderizarDashboard(todasRespostas);
  } catch (err) {
    console.error("Erro ao carregar:", err);
    document.getElementById("areaLoading").innerHTML = `
      <div class="spinner-ldo">
        <span style="font-size:2rem">⚠️</span>
        <p>Erro ao carregar dados. Verifique a conexão e as regras do Firestore.</p>
      </div>`;
    return;
  }
  mostrarLoading(false);
}

// ─── Filtros ──────────────────────────────────────────────────
function popularFiltros() {
  const bairros = [
    ...new Set(
      todasRespostas.map((r) => r.identificacao?.bairro).filter(Boolean),
    ),
  ].sort();
  const zonas = [
    ...new Set(
      todasRespostas.map((r) => r.identificacao?.zona).filter(Boolean),
    ),
  ].sort();
  const perfis = [
    ...new Set(todasRespostas.map((r) => r.perfil).filter(Boolean)),
  ].sort();

  preencherSelect("filtroBairro", bairros);
  preencherSelect("filtroZona", zonas);
  preencherSelect("filtroPerfil", perfis);

  ["filtroBairro", "filtroZona", "filtroSexo", "filtroPerfil"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", aplicarFiltros);
  });
}

function preencherSelect(id, valores) {
  const sel = document.getElementById(id);
  if (!sel) return;
  valores.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
}

function aplicarFiltros() {
  const bairro = document.getElementById("filtroBairro").value;
  const zona = document.getElementById("filtroZona").value;
  const sexo = document.getElementById("filtroSexo").value;
  const perfil = document.getElementById("filtroPerfil").value;
  let dados = todasRespostas;
  if (bairro) dados = dados.filter((r) => r.identificacao?.bairro === bairro);
  if (zona) dados = dados.filter((r) => r.identificacao?.zona === zona);
  if (sexo) dados = dados.filter((r) => r.identificacao?.sexo === sexo);
  if (perfil) dados = dados.filter((r) => r.perfil === perfil);
  renderizarDashboard(dados);
}

// ─── Orquestrador ────────────────────────────────────────────
function renderizarDashboard(dados) {
  renderizarStats(dados);
  renderizarSexo(dados);
  renderizarZona(dados);
  renderizarPerfil(dados);
  renderizarIdade(dados);
  renderizarBairros(dados);
  renderizarPrioridades(dados);
  renderizarNecessidades(dados);
  renderizarAvaliacoesRadar(dados);
  renderizarAvaliacoesBarras(dados);
  renderizarTabelaAvaliacoes(dados);
  renderizarEngajamento(dados);
  renderizarSugestoes(dados);
  renderizarObservacoes(dados);
}

// ══════════════════════════════════════════════════════════════
// BLOCO 1 – ESTATÍSTICAS GERAIS
// ══════════════════════════════════════════════════════════════
function renderizarStats(dados) {
  const total = dados.length;
  set("statTotal", total);

  const bairros = new Set(
    dados.map((r) => r.identificacao?.bairro).filter(Boolean),
  );
  set("statBairros", bairros.size);

  // Média geral de avaliações
  let soma = 0,
    cnt = 0;
  dados.forEach((r) => {
    AREAS_AVAL.forEach((a) => {
      const v = AVAL_NUM[r.avaliacoes?.[a]];
      if (v) {
        soma += v;
        cnt++;
      }
    });
  });
  set("statMedia", cnt ? (soma / cnt).toFixed(1) : "–");

  // Idade média
  const idades = dados
    .map((r) => Number(r.identificacao?.idade))
    .filter((v) => v > 0 && v < 120);
  const idadeMedia = idades.length
    ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length)
    : "–";
  set("statIdadeMedia", idadeMedia !== "–" ? `${idadeMedia} anos` : "–");

  // Zona mais frequente
  set("statZona", topKey(dados.map((r) => r.identificacao?.zona)) || "–");

  // Perfil mais frequente
  set("statPerfil", topKey(dados.map((r) => r.perfil)) || "–");

  // Já participou: conta "Sim"
  const jaParticipou = dados.filter(
    (r) => r.participacao?.participou === "Sim",
  ).length;
  set(
    "statJaParticipou",
    total ? `${jaParticipou} (${pct(jaParticipou, total)}%)` : "–",
  );

  // Acha importante: conta "Sim"
  const acharImportante = dados.filter(
    (r) => r.participacao?.importante === "Sim",
  ).length;
  set(
    "statAchaImportante",
    total ? `${acharImportante} (${pct(acharImportante, total)}%)` : "–",
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCO 2 – PERFIL DOS PARTICIPANTES
// ══════════════════════════════════════════════════════════════
function renderizarSexo(dados) {
  const cont = contarCampo(dados.map((r) => r.identificacao?.sexo));
  renderPie("chartSexo", cont, PALETA_PIE);
}

function renderizarZona(dados) {
  const cont = contarCampo(dados.map((r) => r.identificacao?.zona));
  renderPie("chartZona", cont, PALETA_PIE);
}

function renderizarPerfil(dados) {
  // simplifica "Outro: XYZ" → "Outro"
  const cont = contarCampo(
    dados.map((r) => (r.perfil?.startsWith("Outro") ? "Outro" : r.perfil)),
  );
  renderPie("chartPerfil", cont, PALETA_PIE);
}

function renderizarIdade(dados) {
  const faixas = {
    "< 18": 0,
    "18–29": 0,
    "30–44": 0,
    "45–59": 0,
    "60+": 0,
    "N/I": 0,
  };
  dados.forEach((r) => {
    const v = Number(r.identificacao?.idade);
    if (!v || v < 1 || v > 120) {
      faixas["N/I"]++;
      return;
    }
    if (v < 18) faixas["< 18"]++;
    else if (v <= 29) faixas["18–29"]++;
    else if (v <= 44) faixas["30–44"]++;
    else if (v <= 59) faixas["45–59"]++;
    else faixas["60+"]++;
  });

  const labels = Object.keys(faixas).filter((k) => faixas[k] > 0);
  const values = labels.map((k) => faixas[k]);

  const ctx = getCtx("chartIdade");
  if (!ctx) return;
  destruir("chartIdade");
  charts["chartIdade"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Participantes",
          data: values,
          backgroundColor: PALETA_BARRAS.slice(0, values.length),
          hoverBackgroundColor: "#1d4ed8",
          borderRadius: 7,
          borderSkipped: false,
        },
      ],
    },
    options: opcoesBar("Participantes"),
  });
}

function renderizarBairros(dados) {
  const cont = {};
  dados.forEach((r) => {
    const b = r.identificacao?.bairro?.trim();
    if (b) cont[b] = (cont[b] || 0) + 1;
  });
  const ordenado = Object.entries(cont)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const max = ordenado[0]?.[1] || 1;

  const el = document.getElementById("rankingBairros");
  if (!el) return;
  if (!ordenado.length) {
    el.innerHTML = "<p class='text-muted small'>Nenhum dado.</p>";
    return;
  }

  el.innerHTML = ordenado
    .map(
      ([nome, cnt], i) => `
    <div class="ranking-item">
      <span class="rank-pos ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">${i + 1}</span>
      <span class="rank-nome">${nome}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt / max) * 100}%"></div></div>
      <span class="rank-count">${cnt}x</span>
    </div>
  `,
    )
    .join("");
}

// ══════════════════════════════════════════════════════════════
// BLOCO 3 – PRIORIDADES E NECESSIDADES
// ══════════════════════════════════════════════════════════════
function renderizarPrioridades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.prioridades || []).forEach((p) => {
      const k = p.startsWith("Outro:") ? "outro" : p;
      cont[k] = (cont[k] || 0) + 1;
    });
  });
  const ordenado = Object.entries(cont)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const labels = ordenado.map(([k]) => LABELS_PRI[k] || k);
  const values = ordenado.map(([, v]) => v);

  const ctx = getCtx("chartPrioridades");
  if (!ctx) return;
  destruir("chartPrioridades");
  charts["chartPrioridades"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Votos",
          data: values,
          backgroundColor: PALETA_BARRAS.slice(0, values.length),
          hoverBackgroundColor: "rgba(26,107,60,1)",
          borderRadius: 7,
          borderSkipped: false,
        },
      ],
    },
    options: opcoesBar("Votos"),
  });
}

function renderizarNecessidades(dados) {
  const cont = {};
  dados.forEach((r) => {
    (r.necessidades || []).forEach((n) => {
      const k = n.trim().toLowerCase();
      if (k) cont[k] = (cont[k] || 0) + 1;
    });
  });
  const ordenado = Object.entries(cont)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const container = document.getElementById("rankingNecessidades");
  if (!container) return;

  if (!ordenado.length) {
    container.innerHTML =
      "<p class='text-muted small'>Nenhuma necessidade registrada.</p>";
    return;
  }
  const max = ordenado[0][1];
  container.innerHTML = ordenado
    .map(
      ([nome, cnt], i) => `
    <div class="ranking-item">
      <span class="rank-pos ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">${i + 1}</span>
      <span class="rank-nome">${capitalize(nome)}</span>
      <div class="rank-bar"><div class="rank-bar-fill" style="width:${(cnt / max) * 100}%"></div></div>
      <span class="rank-count">${cnt}x</span>
    </div>
  `,
    )
    .join("");
}

// ══════════════════════════════════════════════════════════════
// BLOCO 4 – AVALIAÇÕES
// ══════════════════════════════════════════════════════════════
function renderizarAvaliacoesRadar(dados) {
  const medias = AREAS_AVAL.map((a) =>
    media(dados.map((r) => AVAL_NUM[r.avaliacoes?.[a]])),
  );

  const ctx = getCtx("chartAvaliacoes");
  if (!ctx) return;
  destruir("chartAvaliacoes");
  charts["chartAvaliacoes"] = new Chart(ctx, {
    type: "radar",
    data: {
      labels: LABELS_AVAL,
      datasets: [
        {
          label: "Média (1–5)",
          data: medias,
          backgroundColor: "rgba(59,130,246,0.15)",
          borderColor: "#3b82f6",
          borderWidth: 2,
          pointBackgroundColor: "#3b82f6",
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, font: { size: 9 } },
          pointLabels: { font: { size: 10 } },
          grid: { color: "#e5e7eb" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` Média: ${c.raw}` } },
      },
    },
  });
}

function renderizarAvaliacoesBarras(dados) {
  // Barras empilhadas: cada serviço × distribuição de notas
  const datasets = NOTAS.map((nota, i) => ({
    label: NOTAS_LABEL[i],
    data: AREAS_AVAL.map(
      (a) => dados.filter((r) => r.avaliacoes?.[a] === nota).length,
    ),
    backgroundColor: Object.values(PALETA_AVAL)[i],
    borderRadius: 4,
  }));

  const ctx = getCtx("chartAvaliacoesBarras");
  if (!ctx) return;
  destruir("chartAvaliacoesBarras");
  charts["chartAvaliacoesBarras"] = new Chart(ctx, {
    type: "bar",
    data: { labels: LABELS_AVAL, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 14 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: "#f3f4f6" },
        },
      },
    },
  });
}

function renderizarTabelaAvaliacoes(dados) {
  const el = document.getElementById("tabelaAvaliacoes");
  if (!el) return;
  if (!dados.length) {
    el.innerHTML = "<p class='text-muted small'>Sem dados.</p>";
    return;
  }

  const linhas = AREAS_AVAL.map((a, idx) => {
    const contNota = {};
    NOTAS.forEach((n) => {
      contNota[n] = 0;
    });
    dados.forEach((r) => {
      const n = r.avaliacoes?.[a];
      if (n) contNota[n]++;
    });
    const total = Object.values(contNota).reduce((s, v) => s + v, 0);
    const med = media(dados.map((r) => AVAL_NUM[r.avaliacoes?.[a]]));
    const estrelas =
      med > 0
        ? "★".repeat(Math.round(med)) + "☆".repeat(5 - Math.round(med))
        : "–";

    return `
      <tr>
        <td class="fw-semibold">${LABELS_AVAL[idx]}</td>
        ${NOTAS.map(
          (n) => `
          <td class="text-center">
            ${contNota[n]}
            ${total > 0 ? `<small class="text-muted">(${pct(contNota[n], total)}%)</small>` : ""}
          </td>
        `,
        ).join("")}
        <td class="text-center fw-bold" style="color:var(--verde)">${med > 0 ? med.toFixed(1) : "–"}</td>
        <td class="text-center" style="color:#eab308; letter-spacing:-2px">${estrelas}</td>
      </tr>
    `;
  });

  el.innerHTML = `
    <table class="table table-sm table-hover" style="font-size:.85rem">
      <thead style="background:var(--verde-palido)">
        <tr>
          <th>Serviço</th>
          <th class="text-center" style="color:#ef4444">Péssimo</th>
          <th class="text-center" style="color:#f97316">Ruim</th>
          <th class="text-center" style="color:#eab308">Regular</th>
          <th class="text-center" style="color:#22c55e">Bom</th>
          <th class="text-center" style="color:#1a6b3c">Ótimo</th>
          <th class="text-center">Média</th>
          <th class="text-center">Nota</th>
        </tr>
      </thead>
      <tbody>${linhas.join("")}</tbody>
    </table>
  `;
}

// ══════════════════════════════════════════════════════════════
// BLOCO 5 – ENGAJAMENTO
// ══════════════════════════════════════════════════════════════
function renderizarEngajamento(dados) {
  renderDoughnut(
    "chartParticipou",
    contarCampo(dados.map((r) => r.participacao?.participou)),
    ["#1a6b3c", "#ef4444", "#94a3b8"],
  );
  renderDoughnut(
    "chartImportante",
    contarCampo(dados.map((r) => r.participacao?.importante)),
    ["#1a6b3c", "#ef4444", "#eab308"],
  );
  renderDoughnut(
    "chartReceberInfo",
    contarCampo(dados.map((r) => r.participacao?.receberInfo)),
    ["#1a6b3c", "#ef4444", "#94a3b8"],
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCO 6 – SUGESTÕES E OBSERVAÇÕES
// ══════════════════════════════════════════════════════════════
function renderizarSugestoes(dados) {
  const itens = dados.filter((r) => r.sugestoes?.trim()).slice(0, 10);
  const el = document.getElementById("listaSugestoes");
  if (!el) return;
  if (!itens.length) {
    el.innerHTML =
      "<p class='text-muted small'>Nenhuma sugestão registrada.</p>";
    return;
  }
  el.innerHTML = itens
    .map(
      (r) => `
    <div class="sugestao-item">
      <div class="sugestao-autor">
        <i class="bi bi-person-circle me-1"></i>
        ${r.identificacao?.nome || "Anônimo"} · ${r.identificacao?.bairro || "–"}
      </div>
      <div class="sugestao-texto">${escapeHtml(r.sugestoes)}</div>
    </div>
  `,
    )
    .join("");
}

function renderizarObservacoes(dados) {
  const itens = dados.filter((r) => r.observacoes?.trim()).slice(0, 10);
  const el = document.getElementById("listaObservacoes");
  if (!el) return;
  if (!itens.length) {
    el.innerHTML =
      "<p class='text-muted small'>Nenhuma observação registrada.</p>";
    return;
  }
  el.innerHTML = itens
    .map(
      (r) => `
    <div class="sugestao-item">
      <div class="sugestao-autor">
        <i class="bi bi-person-circle me-1"></i>
        ${r.identificacao?.nome || "Anônimo"} · ${r.identificacao?.bairro || "–"}
      </div>
      <div class="sugestao-texto">${escapeHtml(r.observacoes)}</div>
    </div>
  `,
    )
    .join("");
}

// ══════════════════════════════════════════════════════════════
// EXPORTAÇÃO PDF – captura todos os gráficos e tabelas
// ══════════════════════════════════════════════════════════════
document.getElementById("btnExportar")?.addEventListener("click", async () => {

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const LARGURA = 297;
  const ALTURA = 210;
  const MARGEM = 12;
  const CONTEUDO = LARGURA - MARGEM * 2;

  let y = 0;
  let pagina = 1;

  const AZUL = [37, 99, 235];
  const AZUL_CLARO = [219, 234, 254];

  const MAX_ALTURA = 80; // 🔥 CONTROLE PRINCIPAL

  const logo = new Image();
  logo.src = "./img/prefeitura.png";
  await new Promise((res) => (logo.onload = res));

  // ───────── HEADER ─────────
  const cabecalho = (titulo = "") => {
    pdf.setFillColor(...AZUL);
    pdf.rect(0, 0, LARGURA, 18, "F");

    pdf.addImage(logo, "PNG", MARGEM, 2, 14, 14);

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Prefeitura de Oriximiná", 30, 10);

    pdf.setFontSize(8);
    pdf.text(`Página ${pagina}`, LARGURA - MARGEM, 10, { align: "right" });

    y = 24;

    if (titulo) {
      pdf.setFillColor(...AZUL_CLARO);
      pdf.rect(MARGEM, y, CONTEUDO, 8, "F");

      pdf.setTextColor(...AZUL);
      pdf.setFontSize(11);
      pdf.text(titulo, MARGEM + 3, y + 5);

      y += 12;
    }
  };

  const novaPagina = () => {
    pdf.addPage();
    pagina++;
    cabecalho();
  };

  const verificarEspaco = (altura) => {
    if (y + altura > ALTURA - 10) novaPagina();
  };

  // ───────── FUNÇÃO INTELIGENTE (CORRIGIDA) ─────────
  const capturarElemento = async (id) => {
    const el = document.getElementById(id);
    if (!el) return;

    verificarEspaco(70);

    const canvas = await html2canvas(el, { scale: 2 });
    const img = canvas.toDataURL("image/png");

    const ratio = canvas.width / canvas.height;

    let largura = CONTEUDO;
    let altura = largura / ratio;

    // 🔥 CONTROLE DE TAMANHO
    if (altura > MAX_ALTURA) {
      altura = MAX_ALTURA;
      largura = altura * ratio;
    }

    // 🔥 CENTRALIZA
    const x = (LARGURA - largura) / 2;

    pdf.addImage(img, "PNG", x, y, largura, altura);

    y += altura + 10;
  };

  // ───────── TÍTULO DE SEÇÃO ─────────
  const tituloSecao = (txt) => {
    verificarEspaco(12);

    pdf.setFillColor(...AZUL_CLARO);
    pdf.rect(MARGEM, y, CONTEUDO, 8, "F");

    pdf.setTextColor(...AZUL);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(txt, MARGEM + 3, y + 5);

    y += 12;
  };

  // ───────── COMEÇA ─────────
  cabecalho("Relatório Completo LDO");

  // 🟦 VISÃO GERAL
  tituloSecao("Visão Geral");
  await capturarElemento("areaCards");

  // 🟦 PERFIL
  tituloSecao("Perfil dos Participantes");
  await capturarElemento("chartSexo");
  await capturarElemento("chartZona");
  await capturarElemento("chartPerfil");
  await capturarElemento("chartIdade");
  await capturarElemento("rankingBairros");

  // 🟦 PRIORIDADES
  tituloSecao("Prioridades e Necessidades");
  await capturarElemento("chartPrioridades");
  await capturarElemento("rankingNecessidades");

  // 🟦 AVALIAÇÕES
  tituloSecao("Avaliações dos Serviços Públicos");
  await capturarElemento("chartAvaliacoes");
  await capturarElemento("chartAvaliacoesBarras");
  await capturarElemento("tabelaAvaliacoes");

  // 🟦 ENGAJAMENTO
  tituloSecao("Engajamento e Participação");
  await capturarElemento("chartParticipou");
  await capturarElemento("chartImportante");
  await capturarElemento("chartReceberInfo");

  // 🟦 SUGESTÕES
  tituloSecao("Sugestões");
  await capturarElemento("listaSugestoes");

  // 🟦 OBSERVAÇÕES
  tituloSecao("Observações");
  await capturarElemento("listaObservacoes");

  pdf.save("relatorio_ldo_completo.pdf");
});
// ══════════════════════════════════════════════════════════════
// HELPERS DE GRÁFICO
// ══════════════════════════════════════════════════════════════
function renderPie(id, cont, cores) {
  const ctx = getCtx(id);
  if (!ctx) return;
  destruir(id);
  const labels = Object.keys(cont);
  const values = Object.values(cont);
  charts[id] = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: cores.slice(0, labels.length),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 14, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${c.label}: ${c.raw} (${pct(c.raw, total)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderDoughnut(id, cont, cores) {
  const ctx = getCtx(id);
  if (!ctx) return;
  destruir(id);
  const labels = Object.keys(cont);
  const values = Object.values(cont);
  charts[id] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: cores.slice(0, labels.length),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "55%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, boxWidth: 14, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = c.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${c.label}: ${c.raw} (${pct(c.raw, total)}%)`;
            },
          },
        },
      },
    },
  });
}

function opcoesBar(label) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (c) => ` ${c.raw} ${label.toLowerCase()}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
        grid: { color: "#f3f4f6" },
      },
    },
  };
}

// ══════════════════════════════════════════════════════════════
// HELPERS GERAIS
// ══════════════════════════════════════════════════════════════
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function getCtx(id) {
  return document.getElementById(id)?.getContext("2d") || null;
}
function destruir(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}
function contarCampo(arr) {
  const cont = {};
  arr.filter(Boolean).forEach((v) => {
    cont[v] = (cont[v] || 0) + 1;
  });
  return cont;
}
function topKey(arr) {
  const cont = contarCampo(arr);
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}
function media(arr) {
  const v = arr.filter(Boolean);
  return v.length
    ? parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2))
    : 0;
}
function pct(val, total) {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Botão atualizar ─────────────────────────────────────────
document
  .getElementById("btnAtualizar")
  ?.addEventListener("click", carregarDados);

// ─── Loading ─────────────────────────────────────────────────
function mostrarLoading(show) {
  const loading = document.getElementById("areaLoading");
  const conteudo = document.getElementById("areaConteudo");
  if (loading) loading.style.display = show ? "flex" : "none";
  if (conteudo) conteudo.style.display = show ? "none" : "block";
}

// ─── Inicializa ───────────────────────────────────────────────
carregarDados();
