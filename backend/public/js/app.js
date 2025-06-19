// Global utilities
window.utils = {
    // Show toast notification
    showToast: function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 fade-in ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    },
    
    // Copy text to clipboard
    copyToClipboard: function(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Código copiado!', 'success');
        }).catch(() => {
            this.showToast('Erro ao copiar código', 'error');
        });
    },
    
    // Format date to locale string
    formatDate: function(date) {
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Format number with thousands separator
    formatNumber: function(number) {
        return new Intl.NumberFormat('pt-BR').format(number);
    }
};

// Form validation
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('border-red-500');
                    
                    // Show error message
                    const errorMsg = field.nextElementSibling?.classList.contains('error-msg') ?
                        field.nextElementSibling :
                        document.createElement('p');
                    
                    if (!field.nextElementSibling?.classList.contains('error-msg')) {
                        errorMsg.className = 'error-msg text-red-500 text-sm mt-1';
                        field.parentNode.insertBefore(errorMsg, field.nextSibling);
                    }
                    
                    errorMsg.textContent = `${field.getAttribute('placeholder')} é obrigatório`;
                } else {
                    field.classList.remove('border-red-500');
                    const errorMsg = field.nextElementSibling;
                    if (errorMsg?.classList.contains('error-msg')) {
                        errorMsg.remove();
                    }
                }
            });
            
            if (!isValid) {
                e.preventDefault();
            }
        });
    });
});

// Input masking for code field
const codeInputs = document.querySelectorAll('input[type="text"][maxlength="6"]');
codeInputs.forEach(input => {
    input.addEventListener('input', function(e) {
        // Only allow numbers
        this.value = this.value.replace(/\D/g, '');
        
        // Auto format with spaces
        const formatted = this.value.match(/.{1,3}/g)?.join(' ') || '';
        if (formatted !== this.value) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = formatted;
            this.setSelectionRange(start, end);
        }
    });
});

// Loading state for buttons
const buttons = document.querySelectorAll('button[type="submit"]');
buttons.forEach(button => {
    button.addEventListener('click', function() {
        if (!this.closest('form').checkValidity()) return;
        
        const loadingText = this.getAttribute('data-loading') || 'Processando...';
        const originalContent = this.innerHTML;
        
        this.disabled = true;
        this.innerHTML = `
            <div class="spinner mr-2"></div>
            ${loadingText}
        `;
        
        // Reset button after form submission (success or error)
        setTimeout(() => {
            this.disabled = false;
            this.innerHTML = originalContent;
        }, 5000); // Fallback timeout
    });
});

// Responsive navigation
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.querySelector('[data-mobile-menu]');

if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        document.body.classList.toggle('overflow-hidden');
    });
}

// Auto-hide notifications
const notifications = document.querySelectorAll('[data-notification]');
notifications.forEach(notification => {
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
});

// Dark mode toggle
const darkModeToggle = document.querySelector('[data-dark-mode-toggle]');
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', 
            document.documentElement.classList.contains('dark') ? 'enabled' : 'disabled'
        );
    });
}

// Initialize dark mode based on user preference
if (localStorage.getItem('darkMode') === 'enabled' ||
    (!localStorage.getItem('darkMode') && 
     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
}

// Handle offline/online status
window.addEventListener('online', () => {
    utils.showToast('Conexão restaurada', 'success');
});

window.addEventListener('offline', () => {
    utils.showToast('Sem conexão com a internet', 'error');
});

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}
