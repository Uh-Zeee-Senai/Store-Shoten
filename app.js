// Registro do Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

const STORAGE_KEY = 'encomenda';
const CART_KEY = 'carrinho-jashin';
let encomendas = [];
let carrinho = [];
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('installBtn').hidden = false;
});

document.addEventListener('DOMContentLoaded', () => {
    carregarEncomendas();
    carregarCarrinho();
    renderizarEncomendas();
    renderizarCatalogo();
    atualizarCarrinho();
    document.getElementById('encomendaForm').addEventListener('submit', adicionarEncomenda);
    document.getElementById('produtoForm').addEventListener('submit', salvarProduto);
    document.getElementById('installBtn').addEventListener('click', instalarPwa);
});

function carregarEncomendas() {
    const dados = localStorage.getItem(STORAGE_KEY);
    encomendas = dados ? JSON.parse(dados) : [];
}

function carregarCarrinho() {
    const dados = localStorage.getItem(CART_KEY);
    carrinho = dados ? JSON.parse(dados) : [];
}

function salvarEncomendas() { localStorage.setItem(STORAGE_KEY, JSON.stringify(encomendas)); }
function salvarCarrinho() { localStorage.setItem(CART_KEY, JSON.stringify(carrinho)); }

function abrirAba(aba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === aba));
    document.getElementById(`${aba}Tab`).classList.add('active');
    if (aba === 'comprar') renderizarCatalogo();
}

function renderizarEncomendas() {
    const lista = document.getElementById('encomendaList');
    if (!encomendas.length) {
        lista.innerHTML = '<p class="empty-message">Nenhuma encomenda registrada.</p>';
        return;
    }
    lista.innerHTML = encomendas.map(livro => `
        <div class="encomenda-item">
            <strong>${escapeHtml(livro.numero)}</strong>
            <p>${escapeHtml(livro.autor || 'Autor não informado')} · ${escapeHtml(livro.versao || 'Versão não informada')}</p>
            <p class="encomenda-meta">${escapeHtml(livro.editora || 'Editora não informada')} — ${escapeHtml(livro.descricao)}</p>
            <div class="encomenda-actions">
                <button class="btn btn-check ${livro.comprado ? 'checked' : ''}" onclick="abrirProdutoModal(${livro.id})">${livro.comprado ? 'Editar na loja' : 'Marcar como comprado'}</button>
                <button class="btn btn-delete" onclick="deletarEncomenda(${livro.id})">Remover</button>
            </div>
        </div>`).join('');
}

function renderizarCatalogo() {
    const lista = document.getElementById('catalogoList');
    const produtos = encomendas.filter(livro => livro.comprado && Number(livro.estoque) > 0 && livro.preco !== undefined);
    if (!produtos.length) {
        lista.innerHTML = '<p class="empty-shop">O acervo ainda está sendo preparado. Marque uma encomenda como comprada para adicioná-la à loja.</p>';
        return;
    }
    lista.innerHTML = produtos.map(livro => `
        <article class="book-card">
            ${livro.imagem ? `<img class="book-cover" src="${livro.imagem}" alt="Capa de ${escapeHtml(livro.numero)}">` : '<div class="book-cover-placeholder" aria-hidden="true">✦</div>'}
            <div class="book-info">
                <h3>${escapeHtml(livro.numero)}</h3>
                <p>${escapeHtml(livro.autor || '')}</p>
                <p>${escapeHtml(livro.editora || '')} · ${escapeHtml(livro.versao || '')}</p>
                ${renderizarDetalhesLoja(livro)}
                <span class="book-price">${formatarPreco(livro.preco)}</span>
                <button class="btn btn-primary" onclick="adicionarAoCarrinho(${livro.id})">Adicionar à sacola</button>
            </div>
        </article>`).join('');
}

function toggleFormSection() {
    const formSection = document.getElementById('formSection');
    formSection.classList.toggle('visible');
    if (formSection.classList.contains('visible')) document.getElementById('numeroEncomenda').focus();
}

function adicionarEncomenda(evento) {
    evento.preventDefault();
    const nome = document.getElementById('numeroEncomenda').value.trim();
    if (encomendas.some(livro => livro.numero.toLocaleLowerCase() === nome.toLocaleLowerCase())) {
        alert('Já existe uma encomenda para este livro.');
        return;
    }
    encomendas.push({
        id: Date.now(), numero: nome, autor: document.getElementById('autor').value.trim(),
        editora: document.getElementById('editora').value.trim(), versao: document.getElementById('versao').value,
        descricao: document.getElementById('descricao').value.trim(), comprado: false,
        dataCriacao: new Date().toLocaleString('pt-BR')
    });
    salvarEncomendas();
    evento.target.reset();
    toggleFormSection();
    renderizarEncomendas();
    mostrarNotificacao('Encomenda adicionada!');
}

function abrirProdutoModal(id) {
    const livro = encomendas.find(item => item.id === id);
    if (!livro) return;
    document.getElementById('produtoId').value = livro.id;
    document.getElementById('produtoLivroNome').textContent = livro.numero;
    document.getElementById('produtoPreco').value = livro.preco ?? '';
    document.getElementById('produtoEstoque').value = livro.estoque ?? 1;
    document.getElementById('produtoIdioma').value = livro.informacoesLoja?.idioma ?? '';
    document.getElementById('produtoConservacao').value = livro.informacoesLoja?.conservacao ?? '';
    document.getElementById('produtoVolume').value = livro.informacoesLoja?.volume ?? '';
    document.getElementById('produtoBrindes').value = livro.informacoesLoja?.brindes ?? '';
    document.getElementById('produtoObservacoes').value = livro.informacoesLoja?.observacoes ?? livro.detalhesLoja ?? '';
    document.getElementById('produtoImagem').value = '';
    document.getElementById('produtoModal').hidden = false;
    document.getElementById('produtoModal').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharProdutoModal() { document.getElementById('produtoModal').hidden = true; }

function salvarProduto(evento) {
    evento.preventDefault();
    const livro = encomendas.find(item => item.id === Number(document.getElementById('produtoId').value));
    if (!livro) return;
    const aplicarDados = (imagem = livro.imagem || '') => {
        livro.comprado = true;
        livro.preco = Number(document.getElementById('produtoPreco').value);
        livro.estoque = Number(document.getElementById('produtoEstoque').value);
        livro.informacoesLoja = {
            idioma: document.getElementById('produtoIdioma').value.trim(),
            conservacao: document.getElementById('produtoConservacao').value,
            volume: document.getElementById('produtoVolume').value.trim(),
            brindes: document.getElementById('produtoBrindes').value.trim(),
            observacoes: document.getElementById('produtoObservacoes').value.trim()
        };
        livro.imagem = imagem;
        livro.dataConferencia = new Date().toLocaleString('pt-BR');
        salvarEncomendas();
        fecharProdutoModal();
        renderizarEncomendas();
        renderizarCatalogo();
        mostrarNotificacao('Livro adicionado à loja!');
    };
    const arquivo = document.getElementById('produtoImagem').files[0];
    if (!arquivo) return aplicarDados();
    const leitor = new FileReader();
    leitor.onload = () => aplicarDados(leitor.result);
    leitor.readAsDataURL(arquivo);
}

function adicionarAoCarrinho(id) {
    const livro = encomendas.find(item => item.id === id);
    if (!livro) return;
    const item = carrinho.find(produto => produto.id === id);
    const quantidadeNoCarrinho = item ? item.quantidade : 0;
    if (quantidadeNoCarrinho >= livro.estoque) {
        mostrarNotificacao('Não há mais unidades disponíveis.');
        return;
    }
    if (item) item.quantidade += 1;
    else carrinho.push({ id: livro.id, quantidade: 1 });
    salvarCarrinho();
    atualizarCarrinho();
    mostrarNotificacao('Livro adicionado à sacola!');
}

function toggleCarrinho() {
    const painel = document.getElementById('carrinho');
    painel.hidden = !painel.hidden;
    if (!painel.hidden) atualizarCarrinho();
}

function atualizarCarrinho() {
    const itens = carrinho.map(item => ({ ...item, livro: encomendas.find(livro => livro.id === item.id) })).filter(item => item.livro);
    const quantidade = itens.reduce((total, item) => total + item.quantidade, 0);
    const total = itens.reduce((soma, item) => soma + item.livro.preco * item.quantidade, 0);
    document.getElementById('cartCount').textContent = quantidade;
    document.getElementById('cartCount').hidden = quantidade === 0;
    document.getElementById('cartCountButton').textContent = quantidade;
    document.getElementById('cartTotal').textContent = formatarPreco(total);
    document.getElementById('carrinhoItens').innerHTML = itens.length ? itens.map(item => `<div class="cart-item"><div><strong>${escapeHtml(item.livro.numero)}</strong><span>${item.quantidade} × ${formatarPreco(item.livro.preco)}</span></div><button class="remove-cart" onclick="removerDoCarrinho(${item.id})">Remover</button></div>`).join('') : '<p class="empty-message">Sua sacola está vazia.</p>';
}

function removerDoCarrinho(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    salvarCarrinho();
    atualizarCarrinho();
}

function finalizarCompra() {
    if (!carrinho.length) return mostrarNotificacao('Adicione um livro à sacola primeiro.');
    carrinho.forEach(item => {
        const livro = encomendas.find(produto => produto.id === item.id);
        if (livro) livro.estoque = Math.max(0, livro.estoque - item.quantidade);
    });
    carrinho = [];
    salvarCarrinho(); salvarEncomendas();
    atualizarCarrinho(); renderizarCatalogo();
    document.getElementById('carrinho').hidden = true;
    mostrarNotificacao('Pedido finalizado com sucesso!');
}

function deletarEncomenda(id) {
    if (!confirm('Tem certeza que deseja remover esta encomenda?')) return;
    encomendas = encomendas.filter(item => item.id !== id);
    carrinho = carrinho.filter(item => item.id !== id);
    salvarEncomendas(); salvarCarrinho();
    renderizarEncomendas(); renderizarCatalogo(); atualizarCarrinho();
    mostrarNotificacao('Encomenda removida com sucesso!');
}

async function instalarPwa() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('installBtn').hidden = true;
}

function formatarPreco(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function renderizarDetalhesLoja(livro) {
    const informacoes = livro.informacoesLoja || {};
    const detalhesAntigos = livro.detalhesLoja ? [livro.detalhesLoja] : [];
    const itens = [informacoes.idioma, informacoes.conservacao, informacoes.volume, informacoes.brindes, informacoes.observacoes, ...detalhesAntigos].filter(Boolean);
    return itens.length ? `<p class="book-details">${itens.map(escapeHtml).join(' · ')}</p>` : '';
}
function mostrarNotificacao(mensagem) { const el = document.createElement('div'); el.textContent = mensagem; el.className = 'toast'; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }
function escapeHtml(texto) { const div = document.createElement('div'); div.textContent = texto ?? ''; return div.innerHTML; }
