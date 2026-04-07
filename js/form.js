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
  getDocs,
  query,
  where,
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

// ─── Verificação de e-mail único no Firestore ────────────────
/**
 * Consulta o Firestore e verifica se o e-mail já foi usado.
 * Retorna true se o e-mail JÁ EXISTE (duplicado), false se está livre.
 */
async function emailJaCadastrado(email) {
  const q    = query(
    collection(db, COL_RESPOSTAS),
    where("identificacao.email", "==", email.toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Feedback em tempo real (ao sair do campo) ───────────────
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

document.getElementById("nome")?.addEventListener("blur", () => {
  const v = document.getElementById("nome").value.trim();
  v ? marcarValido("nome") : marcarInvalido("nome", "Informe seu nome completo.");
});
document.getElementById("idade")?.addEventListener("blur", () => {
  const v = Number(document.getElementById("idade").value);
  (v >= 1 && v <= 120) ? marcarValido("idade") : marcarInvalido("idade", "Informe uma idade válida.");
});
document.getElementById("telefone")?.addEventListener("blur", () => {
  const v = document.getElementById("telefone").value.trim();
  v ? marcarValido("telefone") : marcarInvalido("telefone", "Informe seu telefone ou WhatsApp.");
});
document.getElementById("email")?.addEventListener("blur", async () => {
  const v = document.getElementById("email").value.trim();
  if (!v) {
    marcarInvalido("email", "Informe seu e-mail.");
    return;
  }
  if (!reEmail.test(v)) {
    marcarInvalido("email", "Informe um e-mail válido.");
    return;
  }
  // Formato válido → verifica no Firestore se já existe
  try {
    const duplicado = await emailJaCadastrado(v);
    if (duplicado) {
      marcarInvalido("email", "Este e-mail já foi utilizado para responder a consulta.");
    } else {
      marcarValido("email");
    }
  } catch {
    // silencia erro de rede no blur; o submit vai verificar novamente
    marcarValido("email");
  }
});
document.getElementById("bairro")?.addEventListener("blur", () => {
  const v = document.getElementById("bairro").value.trim();
  v ? marcarValido("bairro") : marcarInvalido("bairro", "Informe seu bairro ou localidade.");
});
document.getElementById("zona")?.addEventListener("change", () => {
  const v = document.getElementById("zona").value;
  v ? marcarValido("zona") : marcarInvalido("zona", "Selecione a zona de residência.");
});
document.querySelectorAll('input[name="sexo"]').forEach((r) => {
  r.addEventListener("change", () => {
    const erroSexo = document.getElementById("erroSexo");
    if (erroSexo) erroSexo.style.display = "none";
  });
});

// ─── Progresso visual ────────────────────────────────────────
// Campos obrigatórios de identificação (exceto sexo que é radio)
const CAMPOS_IDENT = ["nome", "idade", "telefone", "email", "bairro", "zona"];

function atualizarProgresso() {
  // conta campos de identificação preenchidos
  const identOk = CAMPOS_IDENT.filter((id) => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== "";
  }).length;
  const sexoOk = document.querySelector('input[name="sexo"]:checked') ? 1 : 0;
  const totalIdent = CAMPOS_IDENT.length + 1; // +1 para sexo

  // perfil selecionado
  const perfilOk = document.querySelector('input[name="perfil"]:checked') ? 1 : 0;

  // ao menos 1 prioridade
  const priOk = document.querySelectorAll('input[name="prioridade"]:checked').length > 0 ? 1 : 0;

  const preenchidos = identOk + sexoOk + perfilOk + priOk;
  const total       = totalIdent + 1 + 1; // ident + perfil + prioridade

  const pct = Math.round((preenchidos / total) * 100);
  if (progressoBarra) progressoBarra.style.width = pct + "%";
}

// Ouvintes de progresso
CAMPOS_IDENT.forEach((id) => {
  document.getElementById(id)?.addEventListener("input",  atualizarProgresso);
  document.getElementById(id)?.addEventListener("change", atualizarProgresso);
});
document.querySelectorAll('input[name="sexo"]')
  .forEach((r) => r.addEventListener("change", atualizarProgresso));
document.querySelectorAll('input[name="perfil"]')
  .forEach((r) => r.addEventListener("change", atualizarProgresso));

// ─── Validação completa ───────────────────────────────────────
/**
 * Marca um campo como inválido e exibe mensagem inline.
 * Retorna false para encadeamento.
 */
function marcarInvalido(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("campo-invalido");
    el.classList.remove("campo-valido");
    // mensagem inline (cria se não existir)
    const erroId = `erro_${id}`;
    let erroEl = document.getElementById(erroId);
    if (!erroEl) {
      erroEl = document.createElement("div");
      erroEl.id = erroId;
      erroEl.className = "campo-erro";
      el.parentNode.appendChild(erroEl);
    }
    erroEl.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i>${msg}`;
    erroEl.style.display = "flex";
  }
  return false;
}

function marcarValido(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("campo-invalido");
    el.classList.add("campo-valido");
    const erroEl = document.getElementById(`erro_${id}`);
    if (erroEl) erroEl.style.display = "none";
  }
}

function limparValidacoes() {
  document.querySelectorAll(".campo-invalido").forEach((el) => {
    el.classList.remove("campo-invalido");
  });
  document.querySelectorAll(".campo-valido").forEach((el) => {
    el.classList.remove("campo-valido");
  });
  document.querySelectorAll(".campo-erro").forEach((el) => {
    el.style.display = "none";
  });
  const erroSexo = document.getElementById("erroSexo");
  if (erroSexo) erroSexo.style.display = "none";
}

function validar() {
  limparValidacoes();
  let valido = true;
  let primeiroErro = null;

  // ── Nome ──
  const nome = document.getElementById("nome").value.trim();
  if (!nome) {
    marcarInvalido("nome", "Informe seu nome completo.");
    if (!primeiroErro) primeiroErro = "nome";
    valido = false;
  } else {
    marcarValido("nome");
  }

  // ── Idade ──
  const idade = document.getElementById("idade").value;
  if (!idade || Number(idade) < 1 || Number(idade) > 120) {
    marcarInvalido("idade", "Informe uma idade válida.");
    if (!primeiroErro) primeiroErro = "idade";
    valido = false;
  } else {
    marcarValido("idade");
  }

  // ── Sexo (radio – tratamento especial) ──
  const sexoCheck = document.querySelector('input[name="sexo"]:checked');
  const erroSexo  = document.getElementById("erroSexo");
  if (!sexoCheck) {
    if (erroSexo) erroSexo.style.display = "flex";
    if (!primeiroErro) primeiroErro = "sexoF";
    valido = false;
  } else {
    if (erroSexo) erroSexo.style.display = "none";
  }

  // ── Telefone ──
  const tel = document.getElementById("telefone").value.trim();
  if (!tel) {
    marcarInvalido("telefone", "Informe seu telefone ou WhatsApp.");
    if (!primeiroErro) primeiroErro = "telefone";
    valido = false;
  } else {
    marcarValido("telefone");
  }

  // ── E-mail ──
  const email = document.getElementById("email").value.trim();
  const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    marcarInvalido("email", "Informe seu e-mail.");
    if (!primeiroErro) primeiroErro = "email";
    valido = false;
  } else if (!reEmail.test(email)) {
    marcarInvalido("email", "Informe um e-mail válido.");
    if (!primeiroErro) primeiroErro = "email";
    valido = false;
  } else {
    marcarValido("email");
  }

  // ── Bairro ──
  const bairro = document.getElementById("bairro").value.trim();
  if (!bairro) {
    marcarInvalido("bairro", "Informe seu bairro ou localidade.");
    if (!primeiroErro) primeiroErro = "bairro";
    valido = false;
  } else {
    marcarValido("bairro");
  }

  // ── Zona ──
  const zona = document.getElementById("zona").value;
  if (!zona) {
    marcarInvalido("zona", "Selecione a zona de residência.");
    if (!primeiroErro) primeiroErro = "zona";
    valido = false;
  } else {
    marcarValido("zona");
  }

  // ── Prioridades ──
  const prioridades = document.querySelectorAll('input[name="prioridade"]:checked');
  if (prioridades.length === 0) {
    mostrarErro("⚠️ Selecione pelo menos 1 área prioritária.");
    if (!primeiroErro) primeiroErro = "listaPrioridades";
    valido = false;
  }

  // Rola até o primeiro campo com erro
  if (!valido) {
    if (primeiroErro) {
      const el = document.getElementById(primeiroErro);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.focus?.(), 400);
      }
    }
    if (prioridades.length > 0) {
      // Só mostra erro geral se não for apenas o de prioridades
      mostrarErro("⚠️ Preencha todos os campos obrigatórios antes de enviar.");
    }
  }

  return valido;
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
    Verificando...
  `;

  try {
    const email = document.getElementById("email").value.trim().toLowerCase();

    // ── Verifica duplicidade antes de salvar ──────────────────
    const duplicado = await emailJaCadastrado(email);
    if (duplicado) {
      marcarInvalido("email", "Este e-mail já foi utilizado para responder a consulta.");
      document.getElementById("email").scrollIntoView({ behavior: "smooth", block: "center" });
      mostrarErro(
        "⚠️ Este e-mail já possui uma resposta registrada. Cada participante pode responder apenas uma vez."
      );
      return; // interrompe o envio
    }

    // ── Salva no Firestore ────────────────────────────────────
    const dados = coletarDados();
    // Normaliza o e-mail para minúsculas antes de salvar
    dados.identificacao.email = email;
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
  // limpar estados de validação
  limparValidacoes();
  // resetar campos desabilitados
  const perfilOutroEl = document.getElementById("perfilOutroTexto");
  if (perfilOutroEl) { perfilOutroEl.disabled = true; perfilOutroEl.value = ""; }
  if (priOutroTexto)  { priOutroTexto.disabled = true;  priOutroTexto.value = ""; }
  // resetar necessidades
  listaNecess.innerHTML = "";
  criarItemNecessidade();
  verificarBotaoNec();
  atualizarContador();
}