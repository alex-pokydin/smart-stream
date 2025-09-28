import { Router } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { OnvifService } from '../services/OnvifService';
import { StreamService } from '../services/StreamService';
export declare function createHealthRouter(database: DatabaseService, onvif: OnvifService, streaming: StreamService): Router;
//# sourceMappingURL=health.d.ts.map