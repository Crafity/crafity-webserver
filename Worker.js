module.exports = function Worker() {

	var self = this
		, workArray = []
		, onfinish = [];

	this.addWork = function (work, data) {
		// Nothing does nothing
		// Only work
		// Work with an id
		// Work with an id and state
		// A dict with work items (id, work)

		workArray.push({ work: work, data: data });
		return self;
	};

	this.onfinish = function (callback) {
		onfinish.push(callback);
		return self;
	};

	function raiseFinish(err, data) {
		onfinish.forEach(function(cb) {
			try {
				cb(err, data);
			} catch (ex) {
			}
		});
		onfinish = [];
		return self;
	}

	this.work = function () {
		var workCount = 0
			, dataList = []
			, firstErr
			, lastOne = false;

		if (workArray.length === 0) {
			raiseFinish(null, dataList);
		} else {
			workArray.forEach(function(workObject, index) {
			lastOne = index + 1 === workArray.length;
			if (!firstErr) {
				workCount++;
				workObject.work(function onWorkFinished(err, result) {
					if (!firstErr) {
						if (err) {
							firstErr = err;
						} else {
							dataList.push({ data: workObject.data, result: result });
						}
					}
					workCount--;
					if (lastOne && workCount === 0) {
						if (firstErr) {
							raiseFinish(firstErr, null);
						} else {
							raiseFinish(err, dataList);
						}
					}
				});
			} else {
				if (lastOne) {
					raiseFinish(firstErr, null);
				}
			}
		});
		}

		return self;
	};
};
