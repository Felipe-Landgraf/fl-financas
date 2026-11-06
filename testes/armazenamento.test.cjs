const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const raiz = path.resolve(__dirname, "..");
const chave = "fl-financas-dados-v1";
const vazios = { versao: 1, lancamentos: [], orcamentos: {} };
const preenchidos = {
  versao: 1,
  lancamentos: [
    {
      id: 1,
      descricao: "Mercado teste",
      valor: 1990,
      data: "2026-11-06",
      tipo: "despesa",
      categoria: "Alimentação",
    },
  ],
  orcamentos: { "2026-11": 10000 },
};

function prepararPagina(
  conteudo = null,
  falhaLeitura = false,
  falhaGravacao = false,
) {
  let salvo = conteudo;
  let gravacoes = 0;
  const elementos = {};
  const eventos = {};
  function elemento(id) {
    if (!elementos[id]) {
      elementos[id] = {
        textContent: "",
        hidden: true,
        open: false,
        addEventListener() {},
        querySelectorAll() {
          return [];
        },
        classList: { toggle() {}, add() {}, remove() {} },
        close() {
          this.open = false;
        },
      };
    }
    return elementos[id];
  }
  const armazenamento = {
    getItem() {
      if (falhaLeitura) throw new Error("Bloqueado");
      return salvo;
    },
    setItem(nome, valor) {
      if (falhaGravacao) throw new Error("Sem espaço");
      salvo = valor;
      gravacoes++;
    },
  };
  const contexto = vm.createContext({
    console,
    localStorage: armazenamento,
    document: {
      getElementById: elemento,
      querySelectorAll() {
        return [];
      },
      body: { classList: { add() {}, remove() {} } },
    },
    window: {
      clearTimeout() {},
      setTimeout() {
        return 1;
      },
      addEventListener(nome, acao) {
        eventos[nome] = acao;
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(raiz, "financas.js"), "utf8"),
    contexto,
  );
  const codigo = fs.readFileSync(path.join(raiz, "script.js"), "utf8");
  const semInicializacao = codigo.replace(
    /\natualizarCategoriasFiltro\(\);\s*atualizarCategoriasFormulario\(\);\s*atualizarTela\(\);\s*$/,
    "",
  );
  assert.notEqual(semInicializacao, codigo);
  vm.runInContext(semInicializacao, contexto);
  vm.runInContext(
    "atualizarTela = function () {}; limparFiltros = function () {};",
    contexto,
  );
  function executar(expressao) {
    return vm.runInContext(expressao, contexto);
  }
  function ler(expressao) {
    return JSON.parse(executar("JSON.stringify(" + expressao + ")"));
  }
  function mudarOutraAba(conteudoNovo, nome = chave) {
    salvo = conteudoNovo;
    assert.equal(
      typeof eventos.storage,
      "function",
      "O projeto deve acompanhar mudanças em outra aba.",
    );
    eventos.storage({
      key: nome,
      newValue: conteudoNovo,
      storageArea: armazenamento,
    });
  }
  return {
    executar,
    ler,
    elemento,
    mudarOutraAba,
    salvo: () => salvo,
    gravacoes: () => gravacoes,
  };
}

test("carrega os lançamentos e o orçamento salvos", () => {
  const pagina = prepararPagina(JSON.stringify(preenchidos));
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.gravacoes(), 0);
});

test("dados inválidos são preservados no armazenamento e geram aviso", () => {
  const pagina = prepararPagina("{arquivo invalido");
  assert.deepEqual(pagina.ler("dados"), vazios);
  assert.equal(pagina.executar("podeSalvar"), false);
  pagina.executar("guardarDados(criarDadosVazios())");
  assert.equal(pagina.salvo(), "{arquivo invalido");
  assert.equal(pagina.gravacoes(), 0);
  assert.match(
    pagina.elemento("aviso-armazenamento").textContent,
    /Nada foi apagado/,
  );
});

test("armazenamento bloqueado permite usar a sessão sem fingir que salvou", () => {
  const pagina = prepararPagina(null, true);
  pagina.executar(
    "guardarDados(" +
      JSON.stringify(preenchidos) +
      "); mensagemSalva('Lançamento adicionado.');",
  );
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.gravacoes(), 0);
  assert.match(
    pagina.elemento("notificacao").textContent,
    /Apenas nesta sessão/,
  );
});

test("falta de espaço preserva os dados anteriores e avisa sobre a sessão", () => {
  const anterior = JSON.stringify(vazios);
  const pagina = prepararPagina(anterior, false, true);
  pagina.executar(
    "guardarDados(" +
      JSON.stringify(preenchidos) +
      "); mensagemSalva('Salvo.');",
  );
  assert.equal(pagina.salvo(), anterior);
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.executar("podeSalvar"), false);
  assert.match(
    pagina.elemento("aviso-armazenamento").textContent,
    /Não foi possível salvar/,
  );
});

test("editar a demonstração não grava nem troca os dados pessoais", () => {
  const anterior = JSON.stringify(preenchidos);
  const pagina = prepararPagina(anterior);
  pagina.executar(
    "entrarDemonstracao(); guardarDados(criarDadosVazios()); sairDemonstracao();",
  );
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.salvo(), anterior);
  assert.equal(pagina.gravacoes(), 0);
});

test("outra aba atualiza os dados e fecha formulários desatualizados", () => {
  const pagina = prepararPagina(JSON.stringify(vazios));
  pagina.elemento("janela-lancamento").open = true;
  pagina.mudarOutraAba(JSON.stringify(preenchidos));
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.elemento("janela-lancamento").open, false);
  assert.equal(pagina.gravacoes(), 0);
});

test("mudanças em outra aba chegam aos dados pessoais durante a demonstração", () => {
  const pagina = prepararPagina(JSON.stringify(vazios));
  pagina.executar("entrarDemonstracao()");
  const antes = pagina.ler("dados");
  pagina.mudarOutraAba(JSON.stringify(preenchidos));
  assert.deepEqual(pagina.ler("dados"), antes);
  pagina.executar("sairDemonstracao()");
  assert.deepEqual(pagina.ler("dados"), preenchidos);
});

test("limpar o armazenamento em outra aba também atualiza o painel", () => {
  const pagina = prepararPagina(JSON.stringify(preenchidos));
  pagina.mudarOutraAba(null, null);
  assert.deepEqual(pagina.ler("dados"), vazios);
});

test("um arquivo inválido vindo de outra aba não apaga o estado válido", () => {
  const pagina = prepararPagina(JSON.stringify(preenchidos));
  pagina.mudarOutraAba('{"versao":99}');
  assert.deepEqual(pagina.ler("dados"), preenchidos);
  assert.equal(pagina.executar("podeSalvar"), false);
  assert.equal(pagina.gravacoes(), 0);
});
