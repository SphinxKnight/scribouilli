import page from 'page'

import { svelteTarget } from "../config";
import { replaceComponent } from "../routeComponentLifeCycle";
import store from "../store";
import CreateNewSite from '../components/screens/CreateNewSite.svelte'
import { fetchAuthenticatedUserLogin } from '../actions.js'
export default () => {
    fetchAuthenticatedUserLogin()

    const createNewSite = new CreateNewSite({
      target: svelteTarget,
      props: {},
    });

    replaceComponent(createNewSite, () => {});
}
