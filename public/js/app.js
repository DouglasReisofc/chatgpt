// Utility functions
window.utils = {
    // Show toast notification
    showToast: function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white ${
            type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } shadow-lg fade-in z-50`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    },

    // Copy text to clipboard
    copyToClipboard: function(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Código copiado com sucesso!', 'success');
        }).catch(() => {
            this.showToast('Erro ao copiar código', 'error');
        });
    },

    // Format date to local string
    formatDate: function(date) {
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Validate email format
    validateEmail: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};

// Auto-initialize components
document.addEventListener('DOMContentLoaded', function() {
    // Initialize dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-toggle');
    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function() {
            const menu = this.nextElementSibling;
            menu.classList.toggle('hidden');
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.matches('.dropdown-toggle')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (!menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }
    });

    // Initialize modals
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal-target');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
            }
        });
    });

    // Close modals
    const modalCloses = document.querySelectorAll('[data-modal-close]');
    modalCloses.forEach(close => {
        close.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });

    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(tooltip => {
        tooltip.addEventListener('mouseenter', function() {
            const text = this.getAttribute('data-tooltip');
            const tooltipEl = document.createElement('div');
            tooltipEl.className = 'absolute bg-black text-white px-2 py-1 rounded text-sm -mt-8 -ml-2 z-50';
            tooltipEl.textContent = text;
            this.appendChild(tooltipEl);
        });

        tooltip.addEventListener('mouseleave', function() {
            const tooltipEl = this.querySelector('div');
            if (tooltipEl) {
                tooltipEl.remove();
            }
        });
    });
});

// Handle form submissions
const forms = document.querySelectorAll('form[data-submit]');
forms.forEach(form => {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitUrl = this.getAttribute('data-submit');
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(submitUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Something went wrong');
            }

            // Handle success
            if (this.hasAttribute('data-success-redirect')) {
                window.location.href = this.getAttribute('data-success-redirect');
            } else {
                window.utils.showToast(result.message || 'Success!', 'success');
            }
        } catch (error) {
            window.utils.showToast(error.message, 'error');
        }
    });
});
