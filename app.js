// Registro do Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}

const STORAGE_KEY = 'encomenda';
let encomendas = [];
let deferredPrompt = null;

// Evento de instalação do PWA
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.hidden = false;
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarEncomendas();
    renderizarEncomendas();
    
    const encomendaForm = document.getElementById('encomendaForm');
    if (encomendaForm) {
        encomendaForm.addEventListener('submit', adicionarEncomenda);
    }

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBtn.hidden = true;
        });
    }
});

// Carregar livros do localStorage
function carregarEncomendas() {
    const dados = localStorage.getItem(STORAGE_KEY);
    encomendas = dados ? JSON.parse(dados) : [];
}

// Renderizar livros na tela
function renderizarEncomendas() {
    const lista = document.getElementById('encomendaList');

    if (encomendas.length === 0) {
        lista.innerHTML = '<p class="empty-message">Nenhuma encomenda registrada.</p>';
        return;
    }

    lista.innerHTML = encomendas.map(p => `
        <div class="encomenda-item">
            <strong>${escapeHtml(p.numero)}</strong>
            <p>${escapeHtml(p.descricao)}</p>
            <div class="encomenda-actions">
                <button class="btn btn-check ${p.comprado ? 'checked' : ''}" 
                        onclick="alternarConferencia(${p.id})">
                    ${p.comprado ? 'Comprado' : 'A Comprar'}
                </button>  
                <button class="btn btn-delete" onclick="deletarEncomenda(${p.id})">
                    Remover
                </button> 
            </div>
        </div>
    `).join('');
}

// Alternar visibilidade do formulário
function toggleFormSection() {
    const formSection = document.getElementById('formSection');
    formSection.classList.toggle('visible');

    if (formSection.classList.contains('visible')) {
        document.getElementById('numeroEncomenda').focus();
    }
}

// Notificação Temporária (Toast)
function mostrarNotificacao(mensagem) {
    const el = document.createElement('div');
    el.textContent = mensagem;
    el.className = 'toast';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// Salvar dados no localStorage
function salvarEncomendas() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encomendas));
}

// Adicionar novo Registro
function adicionarEncomenda(e) {
    e.preventDefault();

    const numeroEncomenda = document.getElementById('numeroEncomenda').value.trim();
    const descricao = document.getElementById('descricao').value.trim();

    if (!numeroEncomenda || !descricao) {
        alert('Preencha todos os campos.');
        return;
    }

    if (encomendas.some(p => p.numero === numeroEncomenda)) {
        alert('Já existe uma encomenda para este livro.');
        return;
    }

    const novoEncomenda = {
        id: Date.now(),
        numero: numeroEncomenda,
        descricao: descricao,
        comprado: false,
        dataCriacao: new Date().toLocaleString('pt-BR'),
        dataConferencia: null
    };

    encomendas.push(novoEncomenda);
    salvarEncomendas();

    document.getElementById('encomendaForm').reset();
    toggleFormSection();
    renderizarEncomendas();
    mostrarNotificacao('Encomenda adicionado!');
}

// Alternar status de conferência
function alternarConferencia(id) {
    const encomenda = encomendas.find(p => p.id === id);
    if (encomenda) {
        encomenda.comprado = !encomenda.comprado;
        encomenda.dataConferencia = encomenda.comprado ? new Date().toLocaleString('pt-BR') : null;
        salvarEncomendas();
        renderizarEncomendas();

        const status = encomenda.comprado ? 'comprado' : 'marcado como não comprado';
        mostrarNotificacao(`Encomenda ${status}!`);
    }
}

// Deletar encomenda
function deletarEncomenda(id) {
    if (confirm('Tem certeza que deseja remover esta encomenda?')) {
        encomendas = encomendas.filter(p => p.id !== id);
        salvarEncomendas();
        renderizarEncomendas();
        
        mostrarNotificacao('Encomenda removido com sucesso!');
    }
}

// Função para sanitizar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}