// Ordem de camadas (z-index) do sistema — quem fica por cima de quem.
// Regra: conteúdo da página < menu lateral / barra do topo < menu do celular
// < janelas (modais) < câmera < avisos (toasts). Cabeçalho fixo de página
// nunca passa de Z.page, senão cobre o menu.
export const Z = {
  page: 20,          // cabeçalhos e barras "grudadas" dentro da página
  sidebar: 46,       // menu lateral do computador (e seus submenus)
  topbar: 45,        // barra do topo (e o menu do usuário)
  drawerBackdrop: 48,// fundo escuro do menu do celular
  drawer: 49,        // menu do celular
  modal: 80,         // janelas (as antigas usam 50–1000, todas acima do menu)
  camera: 5000,      // leitor de código pela câmera: sempre por cima de tudo
  toast: 9999,
} as const
