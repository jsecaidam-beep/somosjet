(() => {
  const posts = JSON.parse(document.querySelector('#jet-posts-data').textContent).posts;
  const dialog = document.querySelector('.post-dialog');
  const image = document.querySelector('#post-dialog-image');
  const counter = document.querySelector('#post-image-count');
  const previous = dialog.querySelector('[aria-label="Imagen anterior"]');
  const next = dialog.querySelector('[aria-label="Imagen siguiente"]');
  let currentPost;
  let images = [];
  let imageIndex = 0;
  function showImage() {
    image.src = images[imageIndex];
    image.alt = `${currentPost.title} · imagen ${imageIndex + 1} de ${images.length}`;
    counter.textContent = `${imageIndex + 1} / ${images.length}`;
    previous.hidden = next.hidden = images.length < 2;
  }
  function moveImage(direction) {
    imageIndex = (imageIndex + direction + images.length) % images.length;
    showImage();
  }
  document.querySelectorAll('[data-post-index]').forEach(button => button.addEventListener('click', () => {
    currentPost = posts[Number(button.dataset.postIndex)];
    images = currentPost.archiveImages?.length ? currentPost.archiveImages : currentPost.images;
    imageIndex = 0;
    document.querySelector('#post-dialog-title').textContent = currentPost.title;
    document.querySelector('#post-dialog-credit').textContent = currentPost.credit;
    document.querySelector('#post-dialog-date').textContent = currentPost.dateLabel;
    document.querySelector('#post-dialog-date').dateTime = currentPost.date;
    document.querySelector('#post-dialog-summary').textContent = currentPost.summary;
    document.querySelector('#post-dialog-origin').textContent = currentPost.kind === 'reel'
      ? 'Miniatura del reel. Mira el video completo en la publicación original.'
      : currentPost.archiveImages?.length ? 'Piezas del archivo de JET. Consulta la publicación original en redes.'
      : currentPost.carouselComplete ? '' : 'Portada de la publicación. El carrusel completo está en Instagram.';
    document.querySelector('#post-dialog-instagram').href = currentPost.url;
    const facebook = document.querySelector('#post-dialog-facebook');
    facebook.hidden = !currentPost.facebookUrl;
    if (currentPost.facebookUrl) facebook.href = currentPost.facebookUrl;
    showImage();
    dialog.showModal();
  }));
  previous.addEventListener('click', () => moveImage(-1));
  next.addEventListener('click', () => moveImage(1));
  dialog.querySelector('.post-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (images.length > 1 && ['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault(); moveImage(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  document.querySelectorAll('[data-post-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.postFilter;
    let visible = 0;
    document.querySelectorAll('[data-post-filter]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
    document.querySelectorAll('.gallery-card').forEach(card => {
      card.hidden = filter !== 'all' && card.dataset.postGroup !== filter;
      if (!card.hidden) { visible++; card.classList.add('is-visible'); }
    });
    document.querySelector('.gallery-count').textContent = `${visible} publicaciones`;
  }));
})();
