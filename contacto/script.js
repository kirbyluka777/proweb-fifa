document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#contact-form');

    if (!form) return;

    form.addEventListener('submit', event => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const data = new FormData(form);
        const name = data.get('name').trim();
        const email = data.get('email').trim();
        const subject = data.get('subject').trim();
        const message = data.get('message').trim();
        const body = [
            `Nombre: ${name}`,
            `Correo: ${email}`,
            '',
            message
        ].join('\n');

        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
});
