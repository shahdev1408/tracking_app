/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundHeadlessTask} from './src/services/backgroundTracker';

registerBackgroundHeadlessTask();

AppRegistry.registerComponent(appName, () => App);