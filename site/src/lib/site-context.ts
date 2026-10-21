import { useOutletContext } from 'react-router';

export type SiteContext = { openSetup: () => void };

/** Open the setup dialog from any page rendered inside the site layout. */
export const useSetup = () => useOutletContext<SiteContext>().openSetup;
