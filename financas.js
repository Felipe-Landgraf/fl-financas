"use strict";
const categoriasReceita = [
    "Salário",
    "Trabalho extra",
    "Rendimentos",
    "Outros",
];
const categoriasDespesa = [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Assinaturas",
    "Outros",
];
const valorMaximo = 999999999;
const limiteLancamentos = 10000;
function criarDadosVazios() {
    return { versao: 1, lancamentos: [], orcamentos: {} };
}
function categoriasDoTipo(tipo) {
    return tipo === "receita" ? categoriasReceita : categoriasDespesa;
}
function dataDeHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}
function mesValido(mes) {
    return /^(20\d{2})-(0[1-9]|1[0-2])$/.test(mes);
}
function dataValida(data) {
    if (!/^(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(data))
        return false;
    const [ano, mes, dia] = data.split("-").map(Number);
    const calendario = new Date(ano, mes - 1, dia);
    return (calendario.getFullYear() === ano &&
        calendario.getMonth() === mes - 1 &&
        calendario.getDate() === dia);
}
function mudarMes(mes, quantidade) {
    const [ano, numero] = mes.split("-").map(Number);
    const data = new Date(ano, numero - 1 + quantidade, 1);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
function nomeDoMes(mes, curto = false) {
    const [ano, numero] = mes.split("-").map(Number);
    const data = new Date(ano, numero - 1, 1);
    return data.toLocaleDateString("pt-BR", {
        month: curto ? "short" : "long",
        year: curto ? undefined : "numeric",
    });
}
function formatarData(data) {
    return data.split("-").reverse().join("/");
}
function formatarMoeda(centavos) {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}
function valorParaCampo(centavos) {
    return (centavos / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function lerValor(texto) {
    const limpo = texto.trim().replace(/^R\$\s*/, "");
    if (!/^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(limpo))
        return null;
    const partes = limpo.replace(/\./g, "").split(",");
    const centavos = Number(partes[0]) * 100 + Number((partes[1] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(centavos) ||
        centavos <= 0 ||
        centavos > valorMaximo)
        return null;
    return centavos;
}
function normalizarTexto(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}
function proximoId(lancamentos) {
    let maior = 0;
    for (const lancamento of lancamentos) {
        if (lancamento.id > maior)
            maior = lancamento.id;
    }
    return maior + 1;
}
function calcularResumo(lancamentos, mes) {
    let receitas = 0;
    let despesas = 0;
    for (const lancamento of lancamentos) {
        if (!lancamento.data.startsWith(mes + "-"))
            continue;
        if (lancamento.tipo === "receita")
            receitas += lancamento.valor;
        else
            despesas += lancamento.valor;
    }
    return { receitas, despesas, saldo: receitas - despesas };
}
function calcularCategorias(lancamentos, mes) {
    const totais = {};
    for (const lancamento of lancamentos) {
        if (lancamento.tipo !== "despesa" || !lancamento.data.startsWith(mes + "-"))
            continue;
        totais[lancamento.categoria] =
            (totais[lancamento.categoria] || 0) + lancamento.valor;
    }
    return Object.keys(totais)
        .map((nome) => ({ nome, valor: totais[nome] }))
        .sort((a, b) => b.valor - a.valor);
}
function lancamentoValido(valor) {
    if (!valor || typeof valor !== "object")
        return false;
    const item = valor;
    return (Number.isSafeInteger(item.id) &&
        item.id > 0 &&
        item.id < 1000000000 &&
        typeof item.descricao === "string" &&
        item.descricao.trim().length >= 2 &&
        item.descricao.length <= 80 &&
        Number.isSafeInteger(item.valor) &&
        item.valor > 0 &&
        item.valor <= valorMaximo &&
        typeof item.data === "string" &&
        dataValida(item.data) &&
        (item.tipo === "receita" || item.tipo === "despesa") &&
        typeof item.categoria === "string" &&
        categoriasDoTipo(item.tipo).includes(item.categoria));
}
function dadosValidos(valor) {
    if (!valor || typeof valor !== "object")
        return false;
    const dados = valor;
    if (dados.versao !== 1 ||
        !Array.isArray(dados.lancamentos) ||
        dados.lancamentos.length > limiteLancamentos)
        return false;
    if (!dados.orcamentos ||
        typeof dados.orcamentos !== "object" ||
        Array.isArray(dados.orcamentos))
        return false;
    const ids = new Set();
    for (const item of dados.lancamentos) {
        if (!lancamentoValido(item) || ids.has(item.id))
            return false;
        ids.add(item.id);
    }
    for (const mes of Object.keys(dados.orcamentos)) {
        const limite = dados.orcamentos[mes];
        if (!mesValido(mes) ||
            !Number.isSafeInteger(limite) ||
            limite <= 0 ||
            limite > valorMaximo)
            return false;
    }
    return true;
}
function assinaturaLancamento(item) {
    return JSON.stringify([
        item.data,
        item.tipo,
        normalizarTexto(item.descricao.trim()),
        item.categoria,
        item.valor,
    ]);
}
function lerLinhasCSV(texto) {
    const linhas = [];
    let linha = [];
    let campo = "";
    let entreAspas = false;
    let fechouAspas = false;
    texto = texto.replace(/^\uFEFF/, "");
    for (let i = 0; i < texto.length; i++) {
        const letra = texto[i];
        if (entreAspas) {
            if (letra === '"' && texto[i + 1] === '"') {
                campo += '"';
                i++;
            }
            else if (letra === '"') {
                entreAspas = false;
                fechouAspas = true;
            }
            else {
                campo += letra;
            }
        }
        else if (letra === '"') {
            if (campo !== "" || fechouAspas)
                throw new Error("O CSV contém aspas fora de posição.");
            entreAspas = true;
        }
        else if (letra === ";") {
            linha.push(campo);
            campo = "";
            fechouAspas = false;
        }
        else if (letra === "\n" || letra === "\r") {
            linha.push(campo);
            if (linha.some((valor) => valor.trim() !== ""))
                linhas.push(linha);
            linha = [];
            campo = "";
            fechouAspas = false;
            if (letra === "\r" && texto[i + 1] === "\n")
                i++;
        }
        else {
            if (fechouAspas && letra.trim() !== "")
                throw new Error("Há texto depois do fechamento de aspas no CSV.");
            if (!fechouAspas)
                campo += letra;
        }
    }
    if (entreAspas)
        throw new Error("O CSV contém um campo com aspas sem fechamento.");
    linha.push(campo);
    if (linha.some((valor) => valor.trim() !== ""))
        linhas.push(linha);
    return linhas;
}
function protegerCelula(texto) {
    const seguro = /^[\s]*[=+@'-]/.test(texto) ? "'" + texto : texto;
    return '"' + seguro.replace(/"/g, '""') + '"';
}
function criarCSV(lancamentos) {
    const linhas = ["data;tipo;descricao;categoria;valor"];
    const ordenados = [...lancamentos].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);
    for (const item of ordenados) {
        const valor = (item.valor / 100).toFixed(2).replace(".", ",");
        linhas.push([item.data, item.tipo, item.descricao, item.categoria, valor]
            .map(protegerCelula)
            .join(";"));
    }
    return "\uFEFF" + linhas.join("\r\n");
}
function prepararImportacao(texto, existentes) {
    const linhas = lerLinhasCSV(texto);
    if (linhas.length < 2)
        throw new Error("O arquivo não tem lançamentos. Use o modelo de CSV disponível na página.");
    const cabecalho = linhas[0].map((valor) => normalizarTexto(valor.trim()));
    if (cabecalho.join(";") !== "data;tipo;descricao;categoria;valor") {
        throw new Error("Use o modelo do FL Finanças: data;tipo;descricao;categoria;valor, separados por ponto e vírgula.");
    }
    if (linhas.length > 5001)
        throw new Error("Importe até 5.000 lançamentos de cada vez.");
    const conhecidos = new Set(existentes.map(assinaturaLancamento));
    const novos = [];
    let repetidos = 0;
    let id = proximoId(existentes);
    for (let i = 1; i < linhas.length; i++) {
        if (linhas[i].length !== 5)
            throw new Error(`O registro ${i + 1} deve ter exatamente cinco campos.`);
        const campos = linhas[i].map((valor) => valor.trim());
        const [data, tipo, descricaoOriginal, categoria, valorTexto] = campos;
        const descricao = descricaoOriginal.replace(/^'(?=['=+@-])/, "");
        const valor = lerValor(valorTexto);
        const item = {
            id,
            data,
            tipo: tipo,
            descricao,
            categoria,
            valor: valor === null ? 0 : valor,
        };
        if (!lancamentoValido(item)) {
            throw new Error(`Confira o registro ${i + 1}: data AAAA-MM-DD, tipo receita ou despesa, descrição de 2 a 80 caracteres, categoria válida e valor positivo com vírgula nos centavos.`);
        }
        const assinatura = assinaturaLancamento(item);
        if (conhecidos.has(assinatura)) {
            repetidos++;
            continue;
        }
        conhecidos.add(assinatura);
        novos.push(item);
        id++;
    }
    if (existentes.length + novos.length > limiteLancamentos)
        throw new Error("O limite é de 10.000 lançamentos neste navegador.");
    return { novos, repetidos };
}
function criarDemonstracao(mesAtual) {
    const dados = criarDadosVazios();
    const salarios = [390000, 420000, 400000, 445000, 425000, 480000];
    const hoje = dataDeHoje();
    let id = 1;
    for (let indice = 0; indice < 6; indice++) {
        const mes = mudarMes(mesAtual, indice - 5);
        if (!mesValido(mes))
            continue;
        function adicionar(descricao, valor, tipo, categoria, dia) {
            if (mes === hoje.slice(0, 7))
                dia = Math.min(dia, Number(hoje.slice(8)));
            dados.lancamentos.push({
                id: id++,
                descricao,
                valor,
                tipo,
                categoria,
                data: `${mes}-${String(dia).padStart(2, "0")}`,
            });
        }
        adicionar("Salário", salarios[indice], "receita", "Salário", 1);
        adicionar("Projeto freelancer", indice === 5 ? 65000 : 25000 + indice * 6000, "receita", "Trabalho extra", 3);
        adicionar("Aluguel", 145000, "despesa", "Moradia", 2);
        adicionar("Compras no mercado", 48275 + (indice - 5) * 1370, "despesa", "Alimentação", 4);
        adicionar("Conta de energia", 17990 + (indice - 5) * 350, "despesa", "Moradia", 5);
        adicionar("Transporte do mês", 16200, "despesa", "Transporte", 6);
        adicionar("Cinema com amigos", 8900, "despesa", "Lazer", 8);
        adicionar("Curso de desenvolvimento", 12990, "despesa", "Educação", 10);
        adicionar("Almoço de domingo", 8640, "despesa", "Alimentação", 12);
        adicionar("Streaming", 3990, "despesa", "Assinaturas", 15);
        dados.orcamentos[mes] = 350000;
    }
    return dados;
}
