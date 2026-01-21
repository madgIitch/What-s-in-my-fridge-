import { registerRootComponent } from 'expo';
import { ensureFirebaseApp } from './src/services/firebase/app';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
ensureFirebaseApp();

const App = require('./App').default;
registerRootComponent(App);
