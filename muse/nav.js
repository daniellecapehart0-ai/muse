import React from 'react';
// Shared navigation: go(route) changes the page; open(modal) shows an editor/detail sheet over it.
export const NavCtx = React.createContext(null);
export const useNav = () => React.useContext(NavCtx);
