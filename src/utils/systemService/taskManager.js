import logger from '../common/logger.js';

class TaskManager {
    constructor() {
        this.activeTasks = 0;
        logger.info('TaskManager initialized.');
    }

    increment(taskName = 'unnamed') {
        this.activeTasks++;
        logger.info(`[Task Start] ${taskName}. Active tasks: ${this.activeTasks}`);
    }

    decrement(taskName = 'unnamed') {
        this.activeTasks = Math.max(0, this.activeTasks - 1);
        logger.info(`[Task End] ${taskName}. Active tasks: ${this.activeTasks}`);
    }

    getActiveCount() {
        return this.activeTasks;
    }
}

const taskManager = new TaskManager();
export default taskManager;
