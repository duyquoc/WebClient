import _ from 'lodash';
import timezone from 'moment-timezone';

import paginator from './paginator/index';
import analytics from './analytics/index';
import authentication from './authentication/index';
import browserSupport from './browserSupport/index';
import bugReport from './bugReport/index';
import commons from './commons/index';
import core from './core/index';
import domains from './domains/index';
import formUtils from './formUtils/index';
import keys from './keys/index';
import members from './members/index';
import organization from './organization/index';
import outside from './outside/index';
import payment from './payment/index';
import settings from './settings/index';
import ui from './ui/index';
import user from './user/index';
import utils from './utils/index';

import CONFIG from './config';
import routes from './routes';
import '../sass/app.scss';

window.moment = timezone;

const templates = require.context('../templates', true, /\.html$/);
templates.keys().forEach(templates);

angular
    .module('proton', [
        'gettext',
        'cgNotify',
        'ngCookies',
        'ngMessages',
        'ngSanitize',
        'ui.router',
        'oc.lazyLoad',
        'templates-app',
        paginator,
        analytics,
        authentication,
        browserSupport,
        bugReport,
        commons,
        core,
        domains,
        formUtils,
        keys,
        members,
        organization,
        outside,
        payment,
        settings,
        ui,
        user,
        utils,
        routes
    ])
    .constant('CONFIG', CONFIG)
    .config((notificationProvider) => {
        notificationProvider.template(require('../templates/notifications/base.tpl.html'));
    })
    .run((
        logoutManager, // Keep the logoutManager here to lunch it
        AppModel,
        tools,
        lazyLoader
    ) => {
        FastClick.attach(document.body);

        lazyLoader.app();

        // Manage responsive changes
        window.addEventListener('resize', _.debounce(tools.mobileResponsive, 50));
        window.addEventListener('orientationchange', tools.mobileResponsive);
        tools.mobileResponsive();

        AppModel.set('showWelcome', true);

        // SVG Polyfill for IE11 @todo lazy load
        window.svg4everybody();
    })

    .config(($httpProvider, CONFIG) => {
        // Http Interceptor to check auth failures for xhr requests
        $httpProvider.interceptors.push('serverTimeInterceptor');
        $httpProvider.interceptors.push('authHttpResponseInterceptor');
        $httpProvider.interceptors.push('formatResponseInterceptor');
        $httpProvider.defaults.headers.common['x-pm-appversion'] = 'Web_' + CONFIG.app_version;
        $httpProvider.defaults.headers.common['x-pm-apiversion'] = CONFIG.api_version;
        $httpProvider.defaults.headers.common.Accept = 'application/vnd.protonmail.v1+json';
        $httpProvider.defaults.withCredentials = true;

        // initialize get if not there
        if (angular.isUndefined($httpProvider.defaults.headers.get)) {
            $httpProvider.defaults.headers.get = {};
        }

        // disable IE ajax request caching (don't use If-Modified-Since)
        $httpProvider.defaults.headers.get['Cache-Control'] = 'no-cache';
        $httpProvider.defaults.headers.get.Pragma = 'no-cache';
    })
    .run(($state, authentication, $log, dispatchers, networkActivityTracker, AppModel) => {
        const { on } = dispatchers();

        on('$stateChangeStart', (event, toState) => {
            networkActivityTracker.clear();

            const isLogin = toState.name === 'login';
            const isSub = toState.name === 'login.sub';
            const isUpgrade = toState.name === 'upgrade';
            const isSupport = toState.name.includes('support');
            const isAccount = toState.name === 'account';
            const isSignup = toState.name === 'signup' || toState.name === 'pre-invite';
            const isUnlock = toState.name === 'login.unlock';
            const isOutside = toState.name.includes('eo');
            const isReset = toState.name.includes('reset');
            const isPgp = toState.name === 'pgp';
            const { isLoggedIn, isLocked } = AppModel.query();

            if (isUnlock && isLoggedIn) {
                return;
            }

            if (isLoggedIn && !isLocked && isUnlock) {
                // If already logged in and unlocked and on the unlock page: redirect to inbox
                event.preventDefault();
                $state.go('secured.inbox');
                return;
            }

            if (isLogin || isSub || isSupport || isAccount || isSignup || isOutside || isUpgrade || isReset || isPgp) {
                // if on the login, support, account, or signup pages dont require authentication
                $log.debug(
                    'appjs:(isLogin || isSub || isSupport || isAccount || isSignup || isOutside || isUpgrade || isReset || isPgp)'
                );
                return; // no need to redirect
            }

            // now, redirect only not authenticated
            if (!authentication.isLoggedIn()) {
                event.preventDefault(); // stop current execution
                $state.go('login'); // go to login
            }
        });

        on('$stateChangeSuccess', () => {
            // Hide requestTimeout
            AppModel.set('requestTimeout', false);

            // Hide all the tooltip
            $('.tooltip')
                .not(this)
                .hide();

            // Close navbar on mobile
            $('.navbar-toggle').click();
            $('#loading_pm, #pm_slow, #pm_slow2').remove();
        });
    })
    .run((consoleMessage) => consoleMessage())
    .config(($logProvider, $compileProvider, $qProvider, CONFIG) => {
        const debugInfo = CONFIG.debug || false;
        $logProvider.debugEnabled(debugInfo);
        $compileProvider.debugInfoEnabled(debugInfo);
        $qProvider.errorOnUnhandledRejections(debugInfo);
    });
