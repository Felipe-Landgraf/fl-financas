"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
const chaveDados = "fl-financas-dados-v1";
const mesCampo = document.getElementById("mes");
const buscaCampo = document.getElementById("busca");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroCategoria = document.getElementById("filtro-categoria");
const formulario = document.getElementById("formulario-lancamento");
const descricaoCampo = document.getElementById("descricao");
const valorCampo = document.getElementById("valor");
const dataCampo = document.getElementById("data");
const categoriaCampo = document.getElementById("categoria");
const formularioOrcamento = document.getElementById("formulario-orcamento");
const limiteCampo = document.getElementById("valor-limite");
const arquivoCampo = document.getElementById("arquivo-csv");
const janelaLancamento = document.getElementById("janela-lancamento");
const janelaOrcamento = document.getElementById("janela-orcamento");
const janelaExcluir = document.getElementById("janela-excluir");
const janelaImportar = document.getElementById("janela-importar");
const modeloLancamento = document.getElementById("modelo-lancamento");
const listaLancamentos = document.getElementById("lista-lancamentos");
const avisoArmazenamento = document.getElementById("aviso-armazenamento");
const notificacao = document.getElementById("notificacao");
const janelas = [
    janelaLancamento,
    janelaOrcamento,
    janelaExcluir,
    janelaImportar,
];
let podeSalvar = true;
let avisoDeDados = "";
let dados = carregarDados();
let dadosPessoais = dados;
let mesSelecionado = dataDeHoje().slice(0, 7);
let modoDemonstracao = false;
let paginaAtual = 1;
let idEdicao = null;
let idExclusao = null;
let importacaoPendente = [];
let temporizadorAviso = 0;
const itensPorPagina = 8;
function escrever(id, texto) {
    const elemento = document.getElementById(id);
    elemento.textContent = texto;
}
function exibir(id, mostrar) {
    const elemento = document.getElementById(id);
    elemento.hidden = !mostrar;
}
function avisar(texto, erro = false) {
    window.clearTimeout(temporizadorAviso);
    notificacao.textContent = texto;
    notificacao.classList.toggle("erro", erro);
    notificacao.hidden = false;
    temporizadorAviso = window.setTimeout(() => {
        notificacao.hidden = true;
    }, erro ? 10000 : 5500);
}
function carregarDados() {
    try {
        const salvos = localStorage.getItem(chaveDados);
        if (!salvos)
            return criarDadosVazios();
        const conteudo = JSON.parse(salvos);
        if (!dadosValidos(conteudo))
            throw new Error("Dados fora do formato esperado.");
        return conteudo;
    }
    catch {
        podeSalvar = false;
        avisoDeDados =
            "Não foi possível ler o armazenamento deste navegador. Nada foi apagado. Os novos dados ficarão apenas nesta sessão; exporte o CSV para guardá-los.";
        return criarDadosVazios();
    }
}
function guardarDados(novosDados) {
    dados = novosDados;
    if (modoDemonstracao)
        return;
    dadosPessoais = dados;
    if (podeSalvar) {
        try {
            localStorage.setItem(chaveDados, JSON.stringify(dados));
        }
        catch {
            podeSalvar = false;
            avisoDeDados =
                "Não foi possível salvar neste navegador. As alterações continuam nesta sessão. Exporte o CSV para guardá-las antes de fechar a página.";
        }
    }
    atualizarAvisoArmazenamento();
}
function atualizarAvisoArmazenamento() {
    avisoArmazenamento.textContent = avisoDeDados;
    avisoArmazenamento.hidden = !avisoDeDados || modoDemonstracao;
}
function mensagemSalva(texto) {
    if (modoDemonstracao)
        avisar(texto + " Alteração apenas na demonstração.");
    else if (!podeSalvar)
        avisar(texto + " Apenas nesta sessão; exporte o CSV.");
    else
        avisar(texto);
}
function sincronizarDados(evento) {
    if (evento.storageArea !== localStorage)
        return;
    if (evento.key !== chaveDados && evento.key !== null)
        return;
    let recebidos;
    try {
        const conteudo = evento.newValue
            ? JSON.parse(evento.newValue)
            : criarDadosVazios();
        if (!dadosValidos(conteudo))
            throw new Error("Dados inválidos.");
        recebidos = conteudo;
    }
    catch {
        podeSalvar = false;
        avisoDeDados =
            "Os dados de outra aba não puderam ser lidos. Seus registros atuais foram mantidos. Exporte o CSV antes de fechar a página.";
        atualizarAvisoArmazenamento();
        avisar("Não foi possível atualizar os dados da outra aba.", true);
        return;
    }
    dadosPessoais = recebidos;
    podeSalvar = true;
    avisoDeDados = "";
    if (modoDemonstracao)
        return;
    dados = recebidos;
    for (const janela of janelas) {
        if (janela.open)
            janela.close();
    }
    idEdicao = null;
    idExclusao = null;
    importacaoPendente = [];
    atualizarTela();
    avisar("Os dados foram atualizados em outra aba. Confira os registros antes de continuar.");
}
function abrirJanela(janela) {
    janela.showModal();
    document.body.classList.add("com-janela");
}
function atualizarCategoriasFormulario(categoriaSelecionada = "") {
    const tipoMarcado = formulario.querySelector('input[name="tipo"]:checked');
    const tipo = tipoMarcado.value;
    categoriaCampo.replaceChildren();
    for (const categoria of categoriasDoTipo(tipo)) {
        categoriaCampo.add(new Option(categoria, categoria));
    }
    if (categoriasDoTipo(tipo).includes(categoriaSelecionada))
        categoriaCampo.value = categoriaSelecionada;
}
function atualizarCategoriasFiltro() {
    const anterior = filtroCategoria.value;
    let categorias = [...new Set([...categoriasReceita, ...categoriasDespesa])];
    if (filtroTipo.value !== "todos")
        categorias = categoriasDoTipo(filtroTipo.value);
    filtroCategoria.replaceChildren(new Option("Todas as categorias", "todas"));
    for (const categoria of categorias)
        filtroCategoria.add(new Option(categoria, categoria));
    filtroCategoria.value = categorias.includes(anterior) ? anterior : "todas";
}
function mudarPeriodo(mes) {
    if (!mesValido(mes)) {
        mesCampo.value = mesSelecionado;
        return;
    }
    mesSelecionado = mes;
    paginaAtual = 1;
    atualizarTela();
}
function textoComparacao(atual, anterior, tipo) {
    if (atual === 0 && anterior === 0)
        return `Nenhuma ${tipo} neste mês`;
    if (anterior === 0)
        return "Sem valor no mês anterior para comparar";
    const variacao = Math.round(((atual - anterior) / anterior) * 100);
    if (variacao === 0)
        return "Mesmo valor do mês anterior";
    return `${Math.abs(variacao)}% ${variacao > 0 ? "a mais" : "a menos"} que no mês anterior`;
}
function atualizarResumo() {
    const atual = calcularResumo(dados.lancamentos, mesSelecionado);
    const anterior = calcularResumo(dados.lancamentos, mudarMes(mesSelecionado, -1));
    escrever("total-saldo", formatarMoeda(atual.saldo));
    escrever("total-receitas", formatarMoeda(atual.receitas));
    escrever("total-despesas", formatarMoeda(atual.despesas));
    escrever("comparacao-receitas", textoComparacao(atual.receitas, anterior.receitas, "receita"));
    escrever("comparacao-despesas", textoComparacao(atual.despesas, anterior.despesas, "despesa"));
}
function lancamentosFiltrados() {
    const busca = normalizarTexto(buscaCampo.value.trim());
    return dados.lancamentos
        .filter((item) => {
        return (item.data.startsWith(mesSelecionado + "-") &&
            (filtroTipo.value === "todos" || item.tipo === filtroTipo.value) &&
            (filtroCategoria.value === "todas" ||
                item.categoria === filtroCategoria.value) &&
            normalizarTexto(item.descricao).includes(busca));
    })
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
}
function criarLinhaLancamento(item) {
    const fragmento = modeloLancamento.content.cloneNode(true);
    const linha = fragmento.querySelector("tr");
    const descricao = linha.querySelector(".descricao-lancamento");
    const data = linha.querySelector(".data-lancamento");
    const categoria = linha.querySelector(".etiqueta-categoria");
    const valor = linha.querySelector(".valor-lancamento");
    const icone = linha.querySelector(".icone-circulo");
    const editar = linha.querySelector(".acao-editar");
    const excluir = linha.querySelector(".acao-excluir");
    descricao.textContent = item.descricao;
    data.textContent = `${formatarData(item.data)} · ${item.tipo === "receita" ? "Receita" : "Despesa"}`;
    categoria.textContent = item.categoria;
    valor.textContent = `${item.tipo === "receita" ? "+" : "−"} ${formatarMoeda(item.valor)}`;
    valor.classList.add(item.tipo);
    icone.classList.add(item.tipo === "receita" ? "entrada" : "saida");
    editar.setAttribute("aria-label", `Editar ${item.descricao}`);
    excluir.setAttribute("aria-label", `Excluir ${item.descricao}`);
    editar.title = "Editar lançamento";
    excluir.title = "Excluir lançamento";
    editar.addEventListener("click", () => abrirFormulario(item));
    excluir.addEventListener("click", () => pedirExclusao(item));
    return linha;
}
function atualizarLista() {
    const filtrados = lancamentosFiltrados();
    const totalMes = dados.lancamentos.filter((item) => item.data.startsWith(mesSelecionado + "-")).length;
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
    paginaAtual = Math.min(paginaAtual, totalPaginas);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const itens = filtrados.slice(inicio, inicio + itensPorPagina);
    listaLancamentos.replaceChildren();
    for (const item of itens)
        listaLancamentos.appendChild(criarLinhaLancamento(item));
    escrever("contador-lancamentos", `${filtrados.length} ${filtrados.length === 1 ? "registro" : "registros"}`);
    exibir("estado-vazio", totalMes === 0);
    exibir("sem-resultados", totalMes > 0 && filtrados.length === 0);
    exibir("tabela-container", filtrados.length > 0);
    exibir("paginacao", filtrados.length > 0);
    escrever("texto-paginacao", `${inicio + 1}–${inicio + itens.length} de ${filtrados.length} lançamentos`);
    escrever("numero-pagina", `${paginaAtual} / ${totalPaginas}`);
    document.getElementById("pagina-anterior").disabled =
        paginaAtual === 1;
    document.getElementById("pagina-seguinte").disabled =
        paginaAtual === totalPaginas;
}
function atualizarGraficoCategorias() {
    const container = document.getElementById("grafico-categorias");
    const categorias = calcularCategorias(dados.lancamentos, mesSelecionado);
    const total = categorias.reduce((soma, item) => soma + item.valor, 0);
    const cores = [
        "#ba96f5",
        "#d4bbff",
        "#9f78e2",
        "#c5a4ec",
        "#ac8bd5",
        "#dac7f5",
        "#9370c7",
        "#b69acb",
    ];
    container.replaceChildren();
    if (categorias.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "categoria-vazia";
        vazio.textContent =
            "Suas despesas por categoria aparecerão aqui assim que você registrar um lançamento.";
        container.appendChild(vazio);
        return;
    }
    categorias.forEach((categoria, indice) => {
        const linha = document.createElement("div");
        linha.className = "categoria-grafico";
        const info = document.createElement("div");
        info.className = "categoria-info";
        const nome = document.createElement("span");
        nome.className = "categoria-nome";
        const ponto = document.createElement("i");
        ponto.className = "ponto-categoria";
        ponto.style.backgroundColor = cores[indice % cores.length];
        ponto.setAttribute("aria-hidden", "true");
        nome.append(ponto, document.createTextNode(categoria.nome));
        const valor = document.createElement("strong");
        valor.textContent = formatarMoeda(categoria.valor);
        info.append(nome, valor);
        const trilho = document.createElement("div");
        trilho.className = "trilho-categoria";
        trilho.setAttribute("aria-hidden", "true");
        const barra = document.createElement("span");
        barra.className = "barra-categoria";
        barra.style.width = `${(categoria.valor / total) * 100}%`;
        barra.style.backgroundColor = cores[indice % cores.length];
        trilho.appendChild(barra);
        linha.append(info, trilho);
        container.appendChild(linha);
    });
}
function atualizarGraficoMeses() {
    const container = document.getElementById("grafico-meses");
    const meses = [];
    for (let i = -5; i <= 0; i++) {
        const mes = mudarMes(mesSelecionado, i);
        meses.push({ mes, resumo: calcularResumo(dados.lancamentos, mes) });
    }
    let maior = 1;
    for (const item of meses)
        maior = Math.max(maior, item.resumo.receitas, item.resumo.despesas);
    container.replaceChildren();
    for (const item of meses) {
        const coluna = document.createElement("div");
        coluna.className = "coluna-grafico";
        if (item.mes === mesSelecionado)
            coluna.classList.add("mes-destaque");
        const descricao = `${nomeDoMes(item.mes)}: receitas ${formatarMoeda(item.resumo.receitas)}, despesas ${formatarMoeda(item.resumo.despesas)}.`;
        coluna.setAttribute("role", "img");
        coluna.setAttribute("aria-label", descricao);
        coluna.tabIndex = 0;
        const barras = document.createElement("div");
        barras.className = "barras-mes";
        barras.setAttribute("aria-hidden", "true");
        for (const tipo of ["receitas", "despesas"]) {
            const barra = document.createElement("span");
            barra.className = `barra-mes ${tipo === "receitas" ? "cor-receita" : "cor-despesa"}`;
            barra.style.height = `${(item.resumo[tipo] / maior) * 92}%`;
            barras.appendChild(barra);
        }
        const rotulo = document.createElement("span");
        rotulo.className = "rotulo-mes";
        rotulo.textContent =
            nomeDoMes(item.mes, true).replace(".", "") + "/" + item.mes.slice(2, 4);
        rotulo.setAttribute("aria-hidden", "true");
        const dica = document.createElement("span");
        dica.className = "dica-mes";
        dica.textContent = descricao;
        dica.setAttribute("aria-hidden", "true");
        coluna.append(barras, rotulo, dica);
        container.appendChild(coluna);
    }
    const totalPeriodo = meses.reduce((soma, item) => soma + item.resumo.receitas + item.resumo.despesas, 0);
    escrever("nota-comparacao", totalPeriodo === 0
        ? "Seus lançamentos vão dar forma a este gráfico. O período inclui os seis meses até o mês selecionado."
        : "Seis meses, incluindo o período selecionado. Passe sobre uma coluna ou use o teclado para consultar os valores.");
}
function atualizarOrcamento() {
    const limite = dados.orcamentos[mesSelecionado] || 0;
    const despesas = calcularResumo(dados.lancamentos, mesSelecionado).despesas;
    const percentual = limite > 0 ? (despesas / limite) * 100 : 0;
    const progresso = document.getElementById("progresso-orcamento");
    const barra = document.getElementById("barra-orcamento");
    escrever("valor-orcamento", limite > 0 ? formatarMoeda(despesas) : "Defina seu limite");
    escrever("porcentagem-orcamento", limite > 0
        ? `${Math.round(percentual)}% utilizado`
        : "Sem orçamento definido");
    escrever("limite-orcamento", limite > 0 ? `de ${formatarMoeda(limite)}` : "");
    barra.style.width = `${Math.min(100, percentual)}%`;
    progresso.setAttribute("aria-valuenow", String(Math.min(100, Math.round(percentual))));
    progresso.setAttribute("aria-valuetext", limite > 0
        ? `${formatarMoeda(despesas)} utilizados de ${formatarMoeda(limite)}`
        : "Sem orçamento definido");
    progresso.classList.toggle("excedido", despesas > limite && limite > 0);
    let mensagem = "Escolha quanto pretende gastar neste mês.";
    if (limite > 0 && despesas < limite)
        mensagem = `${formatarMoeda(limite - despesas)} disponíveis no orçamento.`;
    if (limite > 0 && despesas === limite)
        mensagem = "Você utilizou todo o orçamento deste mês.";
    if (limite > 0 && despesas > limite)
        mensagem = `${formatarMoeda(despesas - limite)} acima do limite definido.`;
    escrever("mensagem-orcamento", mensagem);
    escrever("definir-orcamento", limite > 0 ? "Ajustar orçamento ↗" : "Definir orçamento ↗");
}
function atualizarTela() {
    mesCampo.value = mesSelecionado;
    document.getElementById("mes-anterior").disabled =
        mesSelecionado === "2000-01";
    document.getElementById("mes-seguinte").disabled =
        mesSelecionado === "2099-12";
    exibir("banner-demo", modoDemonstracao);
    exibir("abrir-demo", !modoDemonstracao);
    atualizarAvisoArmazenamento();
    atualizarResumo();
    atualizarLista();
    atualizarGraficoCategorias();
    atualizarGraficoMeses();
    atualizarOrcamento();
}
function abrirFormulario(item) {
    formulario.reset();
    descricaoCampo.setCustomValidity("");
    valorCampo.setCustomValidity("");
    dataCampo.setCustomValidity("");
    idEdicao = item ? item.id : null;
    escrever("titulo-formulario", item ? "Editar lançamento" : "Novo lançamento");
    escrever("rotulo-formulario", item ? "CUIDAR DOS DETALHES" : "UM NOVO MOVIMENTO");
    escrever("salvar-lancamento", item ? "Salvar alterações" : "Salvar lançamento");
    const tipo = item ? item.tipo : "despesa";
    formulario.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
    atualizarCategoriasFormulario(item ? item.categoria : "");
    if (item) {
        descricaoCampo.value = item.descricao;
        valorCampo.value = valorParaCampo(item.valor);
        dataCampo.value = item.data;
    }
    else {
        const hoje = dataDeHoje();
        dataCampo.value = hoje.startsWith(mesSelecionado)
            ? hoje
            : mesSelecionado + "-01";
    }
    abrirJanela(janelaLancamento);
    descricaoCampo.focus();
}
function salvarLancamento(evento) {
    evento.preventDefault();
    const descricao = descricaoCampo.value.trim();
    const valor = lerValor(valorCampo.value);
    const tipo = formulario.querySelector('input[name="tipo"]:checked').value;
    if (descricao.length < 2) {
        descricaoCampo.setCustomValidity("Escreva uma descrição com pelo menos dois caracteres.");
        descricaoCampo.reportValidity();
        return;
    }
    if (valor === null) {
        valorCampo.setCustomValidity("Informe um valor positivo de até R$ 9.999.999,99. Use vírgula nos centavos, como 125,90.");
        valorCampo.reportValidity();
        return;
    }
    if (!dataValida(dataCampo.value)) {
        dataCampo.setCustomValidity("Escolha uma data válida entre 2000 e 2099.");
        dataCampo.reportValidity();
        return;
    }
    if (idEdicao === null && dados.lancamentos.length >= limiteLancamentos) {
        avisar("O limite é de 10.000 lançamentos. Exporte seu CSV para manter uma cópia.", true);
        return;
    }
    const item = {
        id: idEdicao === null ? proximoId(dados.lancamentos) : idEdicao,
        descricao,
        valor,
        tipo,
        data: dataCampo.value,
        categoria: categoriaCampo.value,
    };
    if (!lancamentoValido(item)) {
        avisar("Confira os campos antes de salvar.", true);
        return;
    }
    const lancamentos = idEdicao === null
        ? [...dados.lancamentos, item]
        : dados.lancamentos.map((atual) => atual.id === idEdicao ? item : atual);
    guardarDados({ ...dados, lancamentos });
    mesSelecionado = item.data.slice(0, 7);
    limparFiltros();
    janelaLancamento.close();
    atualizarTela();
    mensagemSalva(idEdicao === null ? "Lançamento adicionado." : "Lançamento atualizado.");
}
function pedirExclusao(item) {
    idExclusao = item.id;
    escrever("resumo-excluir", `${item.descricao} · ${formatarMoeda(item.valor)} · ${formatarData(item.data)}`);
    abrirJanela(janelaExcluir);
}
function excluirLancamento() {
    if (idExclusao === null)
        return;
    guardarDados({
        ...dados,
        lancamentos: dados.lancamentos.filter((item) => item.id !== idExclusao),
    });
    janelaExcluir.close();
    idExclusao = null;
    atualizarTela();
    mensagemSalva("Lançamento excluído.");
}
function abrirOrcamento() {
    const atual = dados.orcamentos[mesSelecionado] || 0;
    escrever("mes-orcamento", `Defina o limite de despesas para ${nomeDoMes(mesSelecionado)}.`);
    limiteCampo.setCustomValidity("");
    limiteCampo.value = atual > 0 ? valorParaCampo(atual) : "";
    exibir("remover-orcamento", atual > 0);
    abrirJanela(janelaOrcamento);
    limiteCampo.focus();
}
function salvarOrcamento(evento) {
    evento.preventDefault();
    const limite = lerValor(limiteCampo.value);
    if (limite === null) {
        limiteCampo.setCustomValidity("Use um valor positivo de até R$ 9.999.999,99, com vírgula nos centavos.");
        limiteCampo.reportValidity();
        return;
    }
    guardarDados({
        ...dados,
        orcamentos: { ...dados.orcamentos, [mesSelecionado]: limite },
    });
    janelaOrcamento.close();
    atualizarTela();
    mensagemSalva("Orçamento atualizado.");
}
function removerOrcamento() {
    const orcamentos = { ...dados.orcamentos };
    delete orcamentos[mesSelecionado];
    guardarDados({ ...dados, orcamentos });
    janelaOrcamento.close();
    atualizarTela();
    mensagemSalva("Orçamento removido deste mês.");
}
function limparFiltros() {
    buscaCampo.value = "";
    filtroTipo.value = "todos";
    filtroCategoria.value = "todas";
    atualizarCategoriasFiltro();
    paginaAtual = 1;
}
function entrarDemonstracao() {
    dadosPessoais = dados;
    dados = criarDemonstracao(mesSelecionado);
    modoDemonstracao = true;
    limparFiltros();
    atualizarTela();
    avisar("Demonstração aberta com dados fictícios. Seus dados pessoais continuam guardados.");
}
function sairDemonstracao() {
    dados = dadosPessoais;
    modoDemonstracao = false;
    limparFiltros();
    atualizarTela();
    avisar("Você voltou aos seus dados.");
}
function exportarCSV() {
    const conteudo = criarCSV(dados.lancamentos);
    const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = endereco;
    link.download = `${modoDemonstracao ? "fl-financas-demonstracao" : "fl-financas-lancamentos"}-${dataDeHoje()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    avisar("CSV preparado com todos os lançamentos. O arquivo não inclui os limites de orçamento.");
}
async function lerArquivoImportado() {
    const arquivo = arquivoCampo.files ? arquivoCampo.files[0] : undefined;
    if (!arquivo)
        return;
    try {
        if (arquivo.size > 1024 * 1024)
            throw new Error("Escolha um CSV de até 1 MB.");
        const texto = await arquivo.text();
        const resultado = prepararImportacao(texto, dados.lancamentos);
        importacaoPendente = resultado.novos;
        escrever("resumo-importacao", `${resultado.novos.length} ${resultado.novos.length === 1 ? "novo lançamento pronto" : "novos lançamentos prontos"} para importar.`);
        const detalhes = document.getElementById("detalhes-importacao");
        detalhes.replaceChildren();
        const receitas = resultado.novos
            .filter((item) => item.tipo === "receita")
            .reduce((soma, item) => soma + item.valor, 0);
        const despesas = resultado.novos
            .filter((item) => item.tipo === "despesa")
            .reduce((soma, item) => soma + item.valor, 0);
        const resumos = [
            ["Receitas", formatarMoeda(receitas)],
            ["Despesas", formatarMoeda(despesas)],
            ["Repetidos ignorados", String(resultado.repetidos)],
        ];
        for (const [rotulo, valor] of resumos) {
            const linha = document.createElement("p");
            const titulo = document.createElement("span");
            const numero = document.createElement("strong");
            titulo.textContent = rotulo;
            numero.textContent = valor;
            linha.append(titulo, numero);
            detalhes.appendChild(linha);
        }
        document.getElementById("confirmar-importacao").disabled = resultado.novos.length === 0;
        abrirJanela(janelaImportar);
    }
    catch (erro) {
        importacaoPendente = [];
        avisar(erro instanceof Error
            ? erro.message
            : "Não foi possível ler esse arquivo.", true);
    }
    finally {
        arquivoCampo.value = "";
    }
}
function confirmarImportacao() {
    if (importacaoPendente.length === 0)
        return;
    const quantidade = importacaoPendente.length;
    const ultimoMes = importacaoPendente
        .map((item) => item.data.slice(0, 7))
        .sort()
        .pop();
    guardarDados({
        ...dados,
        lancamentos: [...dados.lancamentos, ...importacaoPendente],
    });
    importacaoPendente = [];
    mesSelecionado = ultimoMes;
    limparFiltros();
    janelaImportar.close();
    atualizarTela();
    mensagemSalva(`${quantidade} ${quantidade === 1 ? "lançamento importado" : "lançamentos importados"}.`);
}
(_a = document
    .getElementById("novo-lancamento")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => abrirFormulario());
(_b = document
    .getElementById("adicionar-primeiro")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => abrirFormulario());
(_c = document
    .getElementById("mes-anterior")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => mudarPeriodo(mudarMes(mesSelecionado, -1)));
(_d = document
    .getElementById("mes-seguinte")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => mudarPeriodo(mudarMes(mesSelecionado, 1)));
(_e = document.getElementById("pagina-anterior")) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => {
    paginaAtual--;
    atualizarLista();
});
(_f = document.getElementById("pagina-seguinte")) === null || _f === void 0 ? void 0 : _f.addEventListener("click", () => {
    paginaAtual++;
    atualizarLista();
});
(_g = document.getElementById("limpar-filtros")) === null || _g === void 0 ? void 0 : _g.addEventListener("click", () => {
    limparFiltros();
    atualizarLista();
});
(_h = document
    .getElementById("editar-orcamento")) === null || _h === void 0 ? void 0 : _h.addEventListener("click", abrirOrcamento);
(_j = document
    .getElementById("definir-orcamento")) === null || _j === void 0 ? void 0 : _j.addEventListener("click", abrirOrcamento);
(_k = document
    .getElementById("remover-orcamento")) === null || _k === void 0 ? void 0 : _k.addEventListener("click", removerOrcamento);
(_l = document
    .getElementById("confirmar-exclusao")) === null || _l === void 0 ? void 0 : _l.addEventListener("click", excluirLancamento);
(_m = document
    .getElementById("abrir-demo")) === null || _m === void 0 ? void 0 : _m.addEventListener("click", entrarDemonstracao);
(_o = document
    .getElementById("sair-demo")) === null || _o === void 0 ? void 0 : _o.addEventListener("click", sairDemonstracao);
(_p = document.getElementById("exportar")) === null || _p === void 0 ? void 0 : _p.addEventListener("click", exportarCSV);
(_q = document
    .getElementById("importar")) === null || _q === void 0 ? void 0 : _q.addEventListener("click", () => arquivoCampo.click());
(_r = document
    .getElementById("confirmar-importacao")) === null || _r === void 0 ? void 0 : _r.addEventListener("click", confirmarImportacao);
arquivoCampo.addEventListener("change", lerArquivoImportado);
mesCampo.addEventListener("change", () => mudarPeriodo(mesCampo.value));
formulario.addEventListener("submit", salvarLancamento);
formularioOrcamento.addEventListener("submit", salvarOrcamento);
buscaCampo.addEventListener("input", () => {
    paginaAtual = 1;
    atualizarLista();
});
filtroTipo.addEventListener("change", () => {
    paginaAtual = 1;
    atualizarCategoriasFiltro();
    atualizarLista();
});
filtroCategoria.addEventListener("change", () => {
    paginaAtual = 1;
    atualizarLista();
});
for (const campo of [descricaoCampo, valorCampo, dataCampo, limiteCampo]) {
    campo.addEventListener("input", () => campo.setCustomValidity(""));
}
for (const radio of Array.from(formulario.querySelectorAll('input[name="tipo"]'))) {
    radio.addEventListener("change", () => atualizarCategoriasFormulario());
}
for (const botao of Array.from(document.querySelectorAll(".fechar-janela"))) {
    botao.addEventListener("click", () => botao.closest("dialog").close());
}
for (const janela of janelas) {
    janela.addEventListener("close", () => document.body.classList.remove("com-janela"));
    janela.addEventListener("click", (evento) => {
        if (evento.target !== janela)
            return;
        const limites = janela.getBoundingClientRect();
        if (evento.clientX < limites.left ||
            evento.clientX > limites.right ||
            evento.clientY < limites.top ||
            evento.clientY > limites.bottom)
            janela.close();
    });
}
for (const link of Array.from(document.querySelectorAll(".menu a"))) {
    link.addEventListener("click", () => {
        for (const item of Array.from(document.querySelectorAll(".menu a"))) {
            item.classList.remove("ativo");
            item.removeAttribute("aria-current");
        }
        link.classList.add("ativo");
        link.setAttribute("aria-current", "location");
    });
}
window.addEventListener("storage", sincronizarDados);
atualizarCategoriasFiltro();
atualizarCategoriasFormulario();
atualizarTela();
