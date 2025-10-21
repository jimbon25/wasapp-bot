import logger from '../common/logger.js';

class TaskManager {
    constructor() {
        this.activeTasks = 0;
        logger.info('TaskManager initialized.');
    }

    increment() {
        this.activeTasks++;
        logger.info(`Task started. Active tasks: ${this.activeTasks}`);
    }

    decrement() {
        this.activeTasks = Math.max(0, this.activeTasks - 1);
        logger.info(`Task finished. Active tasks: ${this.activeTasks}`);
    }

    getActiveCount() {
        return this.activeTasks;
    }
}

const taskManager = new TaskManager();
export default taskManager;
