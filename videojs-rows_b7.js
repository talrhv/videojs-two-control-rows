function buildTwoRows(player) {
  const cb = player.getChild('controlBar');
  if (!cb) return;
  const cbEl = cb.el();

  // מנקה בניה קודמת
  const prevTop = cbEl.querySelector('.vjs-2row-top');
  const prevBottom = cbEl.querySelector('.vjs-2row-bottom');
  if (prevTop) Array.from(prevTop.childNodes).forEach(n => cbEl.insertBefore(n, prevTop));
  if (prevTop && prevTop.parentNode) prevTop.parentNode.removeChild(prevTop);
  if (prevBottom) Array.from(prevBottom.childNodes).forEach(n => cbEl.insertBefore(n, prevBottom));
  if (prevBottom && prevBottom.parentNode) prevBottom.parentNode.removeChild(prevBottom);

  const children = Array.from(cbEl.children)
    .filter(ch => !ch.classList.contains('vjs-2row-top') && !ch.classList.contains('vjs-2row-bottom'));

  const top = document.createElement('div');
  top.className = 'vjs-2row-top';
  const bottom = document.createElement('div');
  bottom.className = 'vjs-2row-bottom';

  // הוסף את הקונטיינרים בתור ילדים אחרונים (בלי קינון שגוי)
  cbEl.appendChild(top);
  cbEl.appendChild(bottom);

  children.forEach(child => {
    if (child.classList.contains('vjs-progress-control')) top.appendChild(child);
    else bottom.appendChild(child);
  });

  // לוודא שהbar יושב מעל הכול בתוך הווידאו
  player.addClass('vjs-has-2row-controls');
}
