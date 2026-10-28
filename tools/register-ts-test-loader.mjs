import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./tools/ts-test-loader.mjs', pathToFileURL('./'));
