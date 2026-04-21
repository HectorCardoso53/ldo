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

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const MARGEM = 15;
  const LARGURA = 210;
  const ALTURA = 297;
  const AREA = LARGURA - MARGEM * 2;

  let y = 25;

  // ── Carrega brasão ────────────────────────
  let logob64 = null;
  try {
    const r = await fetch("./img/brasao_logo.png");
    if (r.ok) {
      const blob = await r.blob();
      logob64 = await new Promise((res) => {
        const fr = new FileReader();
        fr.onloadend = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
    }
  } catch {
    /* sem logo */
  }

  // ── Cabeçalho — padrão Prefeitura ─────────
  const header = () => {
    const cx = LARGURA / 2;

    if (logob64) {
      pdf.addImage(logob64, "PNG", cx - 9, 5, 18, 18);
    }

    const topo = logob64 ? 26 : 10;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Prefeitura Municipal de Oriximiná", cx, topo, {
      align: "center",
    });
    pdf.text("Secretaria Municipal de Eficiência Governamental", cx, topo + 5, {
      align: "center",
    });
    pdf.text(
      "Diretoria de Diagnóstico, Estatística e Transparência",
      cx,
      topo + 10,
      { align: "center" },
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("RELATÓRIO DE CONSULTA PÚBLICA – LDO 2026", cx, topo + 16, {
      align: "center",
    });

    const lineY = topo + 19;
    pdf.setDrawColor(0);
    pdf.line(MARGEM, lineY, LARGURA - MARGEM, lineY);

    y = lineY + 7;
  };

  // ── Nova página com cabeçalho ──────────────
  const novaPagina = () => {
    pdf.addPage();
    header();
  };

  // ── Verifica espaço restante ───────────────
  const check = (h) => {
    if (y + h > ALTURA - 15) novaPagina();
  };

  // ── Título de seção ────────────────────────
  const titulo = (txt) => {
    check(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(txt, MARGEM, y);
    y += 7;
  };

  // ── Parágrafo de texto ─────────────────────
  const paragrafo = (txt) => {
    check(25);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);

    const linhas = pdf.splitTextToSize(txt, AREA);
    pdf.text(linhas, MARGEM, y);
    y += linhas.length * 5 + 4;
  };

  // ── Gráfico em página própria com destaque ──
  const graficoComDados = async (chartInstance, canvasId, tituloTxt) => {
    const el = document.getElementById(canvasId);
    if (!el || !chartInstance) return;

    const labels = chartInstance.data.labels;
    const dados = chartInstance.data.datasets[0].data;
    const total = dados.reduce((a, b) => a + b, 0);
    const maior = Math.max(...dados);

    // Cada gráfico começa numa área generosa — quebra se não couber
    const alturaGrafico = 90;
    const alturaLegenda = Math.ceil(labels.length / 2) * 7 + 10;
    const alturaTotal = 10 + alturaGrafico + alturaLegenda + 8;
    check(alturaTotal);

    // ── Faixa azul de título ──────────────────
    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(MARGEM, y, AREA, 9, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(tituloTxt.toUpperCase(), LARGURA / 2, y + 6, { align: "center" });
    y += 12;

    // ── Captura e renderiza o gráfico ─────────
    const yInicio = y;
    const canvas = await html2canvas(el, { scale: 3 }); // scale 3 = alta resolução
    const img = canvas.toDataURL("image/png");
    const ratio = canvas.width / canvas.height;

    let larguraG = AREA;
    let alturaG = larguraG / ratio;
    if (alturaG > alturaGrafico) {
      alturaG = alturaGrafico;
      larguraG = alturaG * ratio;
    }

    const xGrafico = MARGEM + (AREA - larguraG) / 2;
    pdf.addImage(img, "PNG", xGrafico, yInicio, larguraG, alturaG);
    y = yInicio + alturaG + 5;

    // ── Linha divisória ───────────────────────
    pdf.setDrawColor(200, 200, 200);
    pdf.line(MARGEM, y, LARGURA - MARGEM, y);
    y += 5;

    // ── Tabela de dados com destaque no maior ─
    pdf.setFontSize(9);
    const colW = AREA / 2;
    let col = 0;
    let yTabela = y;

    for (let i = 0; i < labels.length; i++) {
      const valor = dados[i];
      const pct = total ? Math.round((valor / total) * 100) : 0;
      const eMaior = valor === maior;
      const x = col === 0 ? MARGEM : MARGEM + colW;

      // fundo destacado para o maior valor
      if (eMaior) {
        pdf.setFillColor(219, 234, 254);
        pdf.roundedRect(x, yTabela - 4.5, colW - 2, 6.5, 1, 1, "F");
      }

      // barra proporcional mini
      const barMaxW = colW * 0.3;
      const barW = total ? (valor / maior) * barMaxW : 0;
      pdf.setFillColor(
        eMaior ? 37 : 100,
        eMaior ? 99 : 149,
        eMaior ? 235 : 237,
      );
      pdf.rect(x, yTabela - 3.5, barW, 3, "F");

      // texto label
      pdf.setFont("helvetica", eMaior ? "bold" : "normal");
      pdf.setTextColor(0, 0, 0);
      const labelCurto = pdf.splitTextToSize(labels[i], colW * 0.58)[0];
      pdf.text(labelCurto, x + barMaxW + 2, yTabela);

      // valor e percentual alinhados à direita da coluna
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(eMaior ? 37 : 60, eMaior ? 99 : 60, eMaior ? 235 : 60);
      pdf.text(`${valor} (${pct}%)`, x + colW - 3, yTabela, { align: "right" });
      pdf.setTextColor(0, 0, 0);

      col = col === 0 ? 1 : 0;
      if (col === 0) yTabela += 7;

      if (yTabela > ALTURA - 20) {
        novaPagina();
        yTabela = y;
      }
    }

    y = yTabela + 10;
  };

  // ══════════════════════════════════════
  //  CONTEÚDO
  // ══════════════════════════════════════
  header();

  // 1. Introdução
  titulo("1. Introdução");
  paragrafo(
    "Este relatório apresenta os resultados da Consulta Pública da LDO 2026, " +
      "permitindo compreender as principais demandas da população e orientar as " +
      "decisões da gestão municipal.",
  );

  // 2. Visão Geral
  titulo("2. Visão Geral");
  const total = document.getElementById("statTotal")?.textContent;
  const bairros = document.getElementById("statBairros")?.textContent;
  const media = document.getElementById("statMedia")?.textContent;
  paragrafo(
    `Foram registradas ${total} participações, abrangendo ${bairros} bairros. ` +
      `A média geral de avaliação foi ${media}.`,
  );

  // 3. Perfil
  titulo("3. Perfil dos Participantes");
  await graficoComDados(
    charts["chartSexo"],
    "chartSexo",
    "Distribuição por Sexo",
  );
  await graficoComDados(
    charts["chartZona"],
    "chartZona",
    "Participação por Zona",
  );
  await graficoComDados(
    charts["chartPerfil"],
    "chartPerfil",
    "Perfil dos Participantes",
  );
  paragrafo(
    "Os dados demonstram a diversidade do público participante, sendo essencial " +
      "para garantir representatividade nas decisões públicas.",
  );


  novaPagina();
  // 4. Prioridades
  titulo("4. Prioridades");
  await graficoComDados(
    charts["chartPrioridades"],
    "chartPrioridades",
    "Prioridades Mais Votadas",
  );
  paragrafo(
    "As prioridades refletem diretamente as principais demandas da população, " +
      "devendo ser consideradas como base estratégica para o planejamento municipal.",
  );


  novaPagina();
  // 5. Avaliação
  titulo("5. Avaliação dos Serviços");
  await graficoComDados(
    charts["chartAvaliacoes"],
    "chartAvaliacoes",
    "Avaliação Geral",
  );
  await graficoComDados(
    charts["chartAvaliacoesBarras"],
    "chartAvaliacoesBarras",
    "Distribuição de Notas",
  );
  paragrafo(
    "A avaliação dos serviços públicos permite identificar áreas que necessitam " +
      "de melhorias e aquelas que apresentam bom desempenho.",
  );


  novaPagina();
  // 6. Engajamento
  titulo("6. Engajamento");
  await graficoComDados(
    charts["chartParticipou"],
    "chartParticipou",
    "Participação Anterior",
  );
  await graficoComDados(
    charts["chartImportante"],
    "chartImportante",
    "Importância da Participação",
  );
  paragrafo(
    "Os dados demonstram o nível de envolvimento da população com os processos " +
      "participativos da gestão pública.",
  );

  // 7. Conclusão
  titulo("7. Conclusão");
  paragrafo(
    "Os resultados apresentados reforçam a importância da participação popular e " +
      "servirão como base para a definição das políticas públicas e investimentos do município.",
  );

  // ── Rodapé com paginação ──────────────────
  const totalPags = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.line(MARGEM, 285, LARGURA - MARGEM, 285);
    pdf.text(
      `Rua Barão do Rio Branco, nº 2336 – Centro – Oriximiná/PA – CNPJ 05.131.081/0001-82`,
      LARGURA / 2,
      290,
      { align: "center" },
    );
    pdf.text(`Página ${i} de ${totalPags}`, LARGURA - MARGEM, 290, {
      align: "right",
    });
    pdf.setTextColor(0);
  }

  pdf.save("relatorio_ldo_2026.pdf");
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
