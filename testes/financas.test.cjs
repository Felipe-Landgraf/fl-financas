const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const contexto = vm.createContext({ console });
vm.runInContext(fs.readFileSync(root + "/financas.js", "utf8"), contexto);
const f = vm.runInContext(
  "({lerValor,dataValida,mesValido,mudarMes,calcularResumo,calcularCategorias,dadosValidos,criarCSV,prepararImportacao,lerLinhasCSV,criarDemonstracao})",
  contexto,
);
const simples = (valor) => JSON.parse(JSON.stringify(valor));
const receita = {
  id: 1,
  descricao: "Projeto teste",
  valor: 100010,
  data: "2026-11-02",
  tipo: "receita",
  categoria: "Trabalho extra",
};
const despesa = {
  id: 2,
  descricao: "Mercado teste",
  valor: 3325,
  data: "2026-11-03",
  tipo: "despesa",
  categoria: "Alimentação",
};

test("valores brasileiros são convertidos para centavos exatos", () => {
  assert.equal(f.lerValor("0,10") + f.lerValor("0,20"), 30);
  assert.equal(f.lerValor("1.234,56"), 123456);
  assert.equal(f.lerValor("R$ 10,5"), 1050);
  assert.equal(f.lerValor("9.999.999,99"), 999999999);
});

test("valores negativos, zero, formatos ambíguos e estouros são recusados", () => {
  for (const valor of [
    "0",
    "0,00",
    "-1,00",
    "1e3",
    "NaN",
    "1,234",
    "12.34",
    "1..000",
    "10.000.000,00",
    "1,00x",
    "",
    "   ",
  ])
    assert.equal(f.lerValor(valor), null, valor);
});

test("datas impossíveis são recusadas e anos bissextos são respeitados", () => {
  for (const data of ["2000-02-29", "2024-02-29", "2026-12-31"])
    assert.equal(f.dataValida(data), true, data);
  for (const data of [
    "2026-02-29",
    "2026-02-31",
    "2026-04-31",
    "2026-01-00",
    "1999-12-31",
    "2100-01-01",
  ])
    assert.equal(f.dataValida(data), false, data);
  assert.equal(f.mudarMes("2026-12", 1), "2027-01");
  assert.equal(f.mudarMes("2026-01", -1), "2025-12");
});

test("o resumo considera apenas o mês pedido e permite saldo negativo", () => {
  const anterior = { ...receita, id: 3, data: "2026-10-02", valor: 999999 };
  assert.deepEqual(
    simples(f.calcularResumo([receita, despesa, anterior], "2026-11")),
    { receitas: 100010, despesas: 3325, saldo: 96685 },
  );
  assert.equal(f.calcularResumo([despesa], "2026-11").saldo, -3325);
});

test("as categorias somam somente despesas do mês", () => {
  const outra = { ...despesa, id: 4, valor: 1000 };
  assert.deepEqual(
    simples(f.calcularCategorias([receita, despesa, outra], "2026-11")),
    [{ nome: "Alimentação", valor: 4325 }],
  );
});

test("os dados salvos exigem versão, valores, categorias e IDs válidos", () => {
  const dados = {
    versao: 1,
    lancamentos: [receita, despesa],
    orcamentos: { "2026-11": 40000 },
  };
  assert.equal(f.dadosValidos(dados), true);
  assert.equal(f.dadosValidos({ ...dados, versao: 2 }), false);
  assert.equal(
    f.dadosValidos({ ...dados, lancamentos: [receita, receita] }),
    false,
  );
  assert.equal(
    f.dadosValidos({ ...dados, lancamentos: [{ ...receita, valor: 1.5 }] }),
    false,
  );
  assert.equal(
    f.dadosValidos({
      ...dados,
      lancamentos: [{ ...receita, categoria: "Moradia" }],
    }),
    false,
  );
  assert.equal(
    f.dadosValidos({ ...dados, orcamentos: { "2026-13": 50 } }),
    false,
  );
  assert.equal(
    f.dadosValidos({ ...dados, orcamentos: { "2026-11": -50 } }),
    false,
  );
});

test("CSV preserva acentos, aspas, ponto e vírgula e quebras de linha", () => {
  const especial = { ...despesa, descricao: 'Café; "pão"\nsegunda compra' };
  const resultado = f.prepararImportacao(f.criarCSV([especial]), []);
  assert.equal(resultado.novos[0].descricao, especial.descricao);
  assert.equal(resultado.novos[0].valor, especial.valor);
});

test("CSV protege fórmulas de planilha e pode ser reimportado", () => {
  for (const descricao of ["=SOMA(1;2)", "+123", "-123", "@teste"]) {
    const arquivo = f.criarCSV([{ ...despesa, descricao }]);
    assert.ok(arquivo.includes("\"'" + descricao));
    assert.equal(
      f.prepararImportacao(arquivo, []).novos[0].descricao,
      descricao,
    );
  }
});

test("a importação evita duplicações existentes e dentro do mesmo arquivo", () => {
  const csv = f.criarCSV([receita, despesa, { ...despesa, id: 55 }]);
  const resultado = f.prepararImportacao(csv, [receita]);
  assert.equal(resultado.novos.length, 1);
  assert.equal(resultado.repetidos, 2);
  assert.equal(resultado.novos[0].id, 2);
});

test("um registro inválido impede toda a importação e preserva os existentes", () => {
  const existentes = [receita];
  const antes = JSON.stringify(existentes);
  const csv =
    "data;tipo;descricao;categoria;valor\n2026-11-02;despesa;Mercado;Alimentação;12,30\n2026-02-31;despesa;Invalido;Alimentação;5,00";
  assert.throws(() => f.prepararImportacao(csv, existentes), /registro 3/);
  assert.equal(JSON.stringify(existentes), antes);
});

test("arquivos vazios, cabeçalhos e aspas inválidos têm erros claros", () => {
  for (const texto of [
    "",
    "data;tipo;descricao;categoria;valor",
    "x;y;z\na;b;c",
    'data;tipo;descricao;categoria;valor\n"aberto',
    'a"b;c',
    '"abc"x;def',
  ]) {
    assert.throws(() => f.prepararImportacao(texto, []));
  }
});

test("CSV fora das categorias, tipos ou número de campos é recusado", () => {
  const cabecalho = "data;tipo;descricao;categoria;valor\n";
  for (const linha of [
    "2026-11-02;saque;Teste;Outros;10,00",
    "2026-11-02;receita;Teste;Moradia;10,00",
    "2026-11-02;receita;Teste;Salário;10,00;extra",
  ]) {
    assert.throws(() => f.prepararImportacao(cabecalho + linha, []));
  }
});

test("o limite total de lançamentos é respeitado antes de importar", () => {
  const existentes = Array.from({ length: 10000 }, (_, i) => ({
    ...receita,
    id: i + 1,
  }));
  assert.throws(
    () => f.prepararImportacao(f.criarCSV([despesa]), existentes),
    /10.000/,
  );
});

test("a demonstração produz seis meses de dados válidos e valores coerentes", () => {
  const demo = f.criarDemonstracao("2026-11");
  assert.equal(f.dadosValidos(demo), true);
  assert.equal(demo.lancamentos.length, 60);
  assert.deepEqual(simples(f.calcularResumo(demo.lancamentos, "2026-11")), {
    receitas: 545000,
    despesas: 261985,
    saldo: 283015,
  });
  assert.equal(demo.orcamentos["2026-11"], 350000);
});

test("CSV preserva descricoes que comecam com apostrofo", () => {
  for (const descricao of ["'=SOMA(1;2)", "'Aluguel", "''Compra"]) {
    const resultado = f.prepararImportacao(
      f.criarCSV([{ ...despesa, descricao }]),
      [],
    );
    assert.equal(resultado.novos[0].descricao, descricao);
  }
});
