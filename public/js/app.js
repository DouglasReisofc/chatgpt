// Função para copiar código para a área de transferência
function copyCode(index, code) {
    // Copia o código para a área de transferência
    navigator.clipboard.writeText(code).then(function () {
        // Mostra a notificação
        const notification = document.getElementById('copied-notification-' + index);
        notification.style.display = 'block';

        // Esconde a notificação após 3 segundos
        setTimeout(function () {
            notification.style.display = 'none';
        }, 3000);
    }).catch(function (err) {
        console.error('Erro ao copiar código: ', err);
        alert('Código copiado: ' + code);
    });
}

// Função para atualizar a página
function updatePage() {
    window.location.reload();
}

// Auto-refresh a cada 30 segundos
setInterval(function () {
    window.location.reload();
}, 30000);

// Validação de email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Manipulação do formulário de login
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const verificationForm = document.getElementById('verificationForm');
    let currentEmail = '';

    // Função para solicitar código
    async function requestCode() {
        const email = document.getElementById('email').value;
        if (!email || !validateEmail(email)) {
            alert('Por favor, insira um email válido.');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                currentEmail = email;
                loginForm.style.display = 'none';
                verificationForm.style.display = 'block';
            } else {
                alert(data.error || 'Erro ao enviar código.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Erro ao enviar código. Tente novamente.');
        }
    }

    // Função para verificar código
    async function verifyCode() {
        const code = document.getElementById('code').value;
        if (!code) {
            alert('Por favor, insira o código de verificação.');
            return;
        }

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: currentEmail,
                    code: code
                })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/codes';
            } else {
                alert(data.error || 'Código inválido.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Erro ao verificar código. Tente novamente.');
        }
    }

    // Função para resetar o formulário
    function resetForm() {
        currentEmail = '';
        loginForm.style.display = 'block';
        verificationForm.style.display = 'none';
        document.getElementById('code').value = '';
    }

    // Adiciona os event listeners aos botões
    if (document.getElementById('requestCodeBtn')) {
        document.getElementById('requestCodeBtn').addEventListener('click', requestCode);
    }
    if (document.getElementById('verifyCodeBtn')) {
        document.getElementById('verifyCodeBtn').addEventListener('click', verifyCode);
    }
    if (document.getElementById('resetFormBtn')) {
        document.getElementById('resetFormBtn').addEventListener('click', resetForm);
    }
});

// Tema escuro
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');

    // Salva a preferência do usuário
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
}

// Inicializa o tema escuro baseado na preferência do usuário
if (localStorage.getItem('darkMode') === 'enabled' ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
}
