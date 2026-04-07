/**
 * form.js – Consulta Pública LDO 2026
 * Prefeitura Municipal de Oriximiná
 *
 * Responsabilidades:
 * - Captura e valida todos os campos do formulário
 * - Limita seleção de prioridades (máx. 5)
 * - Ativa/desativa campos "Outro" (perfil e prioridade)
 * - Estrutura e salva os dados no Firestore (coleção respostasLDO)
 * - Limpa o formulário após envio bem-sucedido
 */

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Referência da coleção ───────────────────────────────────
const COL_RESPOSTAS = "respostasLDO";

// ─── Elementos do DOM ────────────────────────────────────────
const form          = document.getElementById("formLDO");
const btnEnviar     = document.getElementById("btnEnviar");
const alertaSucesso = document.getElementById("alertaSucesso");
const alertaErro    = document.getElementById("alertaErro");
const contadorPri   = document.getElementById("contadorPrioridades");
const listaNecess   = document.getElementById("listaNecessidades");
const btnAddNec     = document.getElementById("btnAddNecessidade");
const progressoBarra= document.getElementById("progressoBarra");

// ─── Perfil "Outro" – habilitar campo texto ──────────────────
document.querySelectorAll('input[name="perfil"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const campo = document.getElementById("perfilOutroTexto");
    if (campo) {
      campo.disabled = radio.value !== "Outro" || !radio.checked;
      if (radio.value !== "Outro") campo.value = "";
    }
  });
});

// ─── Prioridade "Outro" – habilitar campo texto ──────────────
const priOutro = document.getElementById("pri_outro");
const priOutroTexto = document.getElementById("prioridadeOutroTexto");
if (priOutro && priOutroTexto) {
  priOutro.addEventListener("change", () => {
    priOutroTexto.disabled = !priOutro.checked;
    if (!priOutro.checked) priOutroTexto.value = "";
  });
}

// ─── Controle de prioridades (máx. 5) ───────────────────────
const MAX_PRIORIDADES = 5;

function atualizarContador() {
  const n = document.querySelectorAll('input[name="prioridade"]:checked').length;
  contadorPri.textContent = `${n} de ${MAX_PRIORIDADES} selecionadas`;
  contadorPri.classList.toggle("limite", n >= MAX_PRIORIDADES);
}

document.querySelectorAll('input[name="prioridade"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    const selecionados = document.querySelectorAll('input[name="prioridade"]:checked');
    if (selecionados.length > MAX_PRIORIDADES) {
      cb.checked = false; // reverte o excesso
    }
    atualizarContador();
    atualizarProgresso();
  });
});

// ─── Necessidades dinâmicas ──────────────────────────────────
const MAX_NECESSIDADES = 5;

function criarItemNecessidade(valor = "") {
  if (listaNecess.querySelectorAll(".necessidade-item").length >= MAX_NECESSIDADES) return;

  const div = document.createElement("div");
  div.className = "necessidade-item";
  div.innerHTML = `
    <input type="text" class="form-control necessidade-input"
           placeholder="Descreva a necessidade..." maxlength="200" value="${valor}">
    <button type="button" class="btn-remover-nec" title="Remover">
      <i class="bi bi-x-lg"></i>
    </button>
  `;
  div.querySelector(".btn-remover-nec").addEventListener("click", () => {
    div.remove();
    verificarBotaoNec();
  });
  listaNecess.appendChild(div);
  verificarBotaoNec();
}

function verificarBotaoNec() {
  const qtd = listaNecess.querySelectorAll(".necessidade-item").length;
  btnAddNec.style.display = qtd >= MAX_NECESSIDADES ? "none" : "";
}

btnAddNec.addEventListener("click", () => criarItemNecessidade());
criarItemNecessidade(); // inicia com 1 campo

// ─── Progresso visual ────────────────────────────────────────
function atualizarProgresso() {
  let total = 4, preenchidos = 0;

  // nome
  if (document.getElementById("nome")?.value.trim()) preenchidos++;
  // bairro
  if (document.getElementById("bairro")?.value.trim()) preenchidos++;
  // zona
  if (document.getElementById("zona")?.value) preenchidos++;
  // perfil (radio)
  if (document.querySelector('input[name="perfil"]:checked')) preenchidos++;

  // bônus: ao menos 1 prioridade (+1 ao total)
  total++;
  if (document.querySelectorAll('input[name="prioridade"]:checked').length > 0) preenchidos++;

  const pct = Math.round((preenchidos / total) * 100);
  if (progressoBarra) progressoBarra.style.width = pct + "%";
}

["nome", "bairro", "zona"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", atualizarProgresso);
  document.getElementById(id)?.addEventListener("change", atualizarProgresso);
});
document.querySelectorAll('input[name="perfil"]')
  .forEach((r) => r.addEventListener("change", atualizarProgresso));

// ─── Validação ───────────────────────────────────────────────
function validar() {
  const nome = document.getElementById("nome").value.trim();
  if (!nome) {
    mostrarErro("⚠️ Por favor, informe seu nome completo.");
    document.getElementById("nome").focus();
    return false;
  }
  const prioridades = document.querySelectorAll('input[name="prioridade"]:checked');
  if (prioridades.length === 0) {
    mostrarErro("⚠️ Selecione pelo menos 1 área prioritária.");
    return false;
  }
  return true;
}

// ─── Coleta de dados ─────────────────────────────────────────
function coletarDados() {
  // Identificação
  const identificacao = {
    nome:     document.getElementById("nome").value.trim(),
    cpf:      document.getElementById("cpf").value.trim(),
    idade:    document.getElementById("idade").value || null,
    sexo:     document.querySelector('input[name="sexo"]:checked')?.value || "",
    telefone: document.getElementById("telefone").value.trim(),
    email:    document.getElementById("email").value.trim(),
    bairro:   document.getElementById("bairro").value.trim(),
    zona:     document.getElementById("zona").value,
  };

  // Perfil (radio)
  const perfilSelecionado = document.querySelector('input[name="perfil"]:checked')?.value || "";
  const perfil = perfilSelecionado === "Outro"
    ? `Outro: ${document.getElementById("perfilOutroTexto")?.value.trim() || ""}`
    : perfilSelecionado;

  // Prioridades (checkbox – máx. 5)
  const prioridades = Array.from(
    document.querySelectorAll('input[name="prioridade"]:checked')
  ).map((cb) => {
    if (cb.value === "outro") {
      const texto = document.getElementById("prioridadeOutroTexto")?.value.trim();
      return texto ? `Outro: ${texto}` : "outro";
    }
    return cb.value;
  });

  // Necessidades
  const necessidades = Array.from(document.querySelectorAll(".necessidade-input"))
    .map((i) => i.value.trim())
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx); // sem vazios e sem duplicatas

  // Sugestões de obras
  const sugestoes = document.getElementById("sugestoes").value.trim();

  // Avaliações (8 áreas)
  const areasAval = [
    "saude", "educacao", "limpeza", "iluminacao",
    "transporte", "seguranca", "infraestrutura", "assistencia",
  ];
  const avaliacoes = {};
  areasAval.forEach((a) => {
    avaliacoes[a] = document.querySelector(`input[name="aval_${a}"]:checked`)?.value || "";
  });

  // Participação
  const participacao = {
    participou:   document.querySelector('input[name="participou"]:checked')?.value   || "",
    importante:   document.querySelector('input[name="importante"]:checked')?.value   || "",
    receberInfo:  document.querySelector('input[name="receberInfo"]:checked')?.value  || "",
  };

  // Observações finais
  const observacoes = document.getElementById("observacoes")?.value.trim() || "";

  return {
    identificacao,
    perfil,
    prioridades,
    necessidades,
    sugestoes,
    avaliacoes,
    participacao,
    observacoes,
    createdAt: serverTimestamp(),
  };
}

// ─── Envio ───────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  esconderAlertas();
  if (!validar()) return;

  // Estado loading
  btnEnviar.disabled = true;
  btnEnviar.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    Enviando...
  `;

  try {
    const dados = coletarDados();
    await addDoc(collection(db, COL_RESPOSTAS), dados);
    mostrarSucesso();
    limparFormulario();
    if (progressoBarra) progressoBarra.style.width = "0%";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Erro ao salvar:", err);
    mostrarErro("❌ Ocorreu um erro ao enviar. Verifique sua conexão e tente novamente.");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = `<i class="bi bi-send-fill me-2"></i>Enviar Participação`;
  }
});

// ─── Helpers UI ──────────────────────────────────────────────
function mostrarSucesso() {
  alertaSucesso.style.display = "block";
  alertaErro.style.display   = "none";
}
function mostrarErro(msg) {
  alertaErro.innerHTML       = `<i class="bi bi-exclamation-triangle-fill me-1"></i>${msg}`;
  alertaErro.style.display   = "block";
  alertaSucesso.style.display= "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function esconderAlertas() {
  alertaSucesso.style.display = "none";
  alertaErro.style.display    = "none";
}
function limparFormulario() {
  form.reset();
  // resetar campos desabilitados
  const perfilOutro = document.getElementById("perfilOutroTexto");
  if (perfilOutro) { perfilOutro.disabled = true; perfilOutro.value = ""; }
  if (priOutroTexto) { priOutroTexto.disabled = true; priOutroTexto.value = ""; }
  // resetar necessidades
  listaNecess.innerHTML = "";
  criarItemNecessidade();
  verificarBotaoNec();
  atualizarContador();
}