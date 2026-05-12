export const USERS = ['maxim', 'oleg', 'lyuba'];

export const USER_LABELS = {
  maxim: 'Максим',
  oleg: 'Олег',
  lyuba: 'Люба'
};

export const USER_LABELS_GENITIVE = {
  maxim: 'Максима',
  oleg: 'Олега',
  lyuba: 'Любы'
};

export const USER_INITIALS = {
  maxim: 'м',
  oleg: 'о',
  lyuba: 'л'
};

export const DEFAULT_USER = 'maxim';

export const otherUsersOf = (user) => USERS.filter((u) => u !== user);
