var assert = require('assert');
var cmd = require('node-cmd');
/**
 * Callback equivalent to that of node-cmd
 * @callback nodeCmdCallback
 * @param {Error} err 
 * @param {string} data
 * @param {string} stdErr
 */

/**
 * await Job Callback
 * @callback awaitJobCallback
 * @param {Error} err 
 */

/**
 * Retrieve Marble Quantity Callback
 * @callback awaitQuantityCallback
 * @param {Error}  err 
 * @param {number} quantity null if marble is not defined in inventory
 * @param {number} cost     null if marble is not defined in inventory
 */

/**
* Polls jobId. Callback is made without error if Job completes with CC 0000 in the allotted time
* @param {string}           jobId     jobId to check the completion of
* @param {awaitJobCallback} callback  function to call after completion
* @param {number}           tries     max attempts to check the completion of the job
* @param {number}           wait      wait time in ms between each check
*/
function awaitJobCompletion(jobId, callback, tries = 30, wait = 1000) {
  if (tries > 0) {
      sleep(wait);
      cmd.get(
      'bright jobs view job-status-by-jobid ' + jobId + ' --rff retcode --rft string',
      function (err, data, stderr) {
          retcode = data.trim();
          if (retcode == "CC 0000") {
            callback(null);
          } else if (retcode == "null") {
            awaitJobCompletion(jobId, callback, tries - 1, wait);
          } else {
            callback(new Error(jobId + " had a return code of " + retcode));
          }
      }
      );
  } else {
      callback(new Error(jobId + " timed out."));
  }
}

/**
* Creates a Marble with an initial quantity
* @param {string}           color        color of Marble to create
* @param {number}           [quantity=1] quantity of Marbles to initially create
* @param {number}           [cost=1]     cost of Marble to create
* @param {nodeCmdCallback}  [callback]   function to call after completion, callback(err, data, stderr)
*/
function createMarble(color, quantity=1, cost=1, callback) {
  cmd.get(
    'bright console issue command "F CICSTRN1,MBXX CRE ' + color + " " + quantity + " " + cost + '" --cn CUSTXXX',
    function (err, data, stderr) {
      typeof callback === 'function' && callback(err, data, stderr);
    }
  );
}

/**
* Deletes a Marble with an initial quantity
* @param {string}           color       color of Marble to delete
* @param {nodeCmdCallback}  [callback]  function to call after completion, callback(err, data, stderr)
*/
function deleteMarble(color, callback) {
  cmd.get(
    'bright console issue command "F CICSTRN1,MBXX DEL ' + color + '" --cn CUSTXXX',
    function (err, data, stderr) {
      typeof callback === 'function' && callback(err, data, stderr);
    }
  );
}

/**
* Gets quantity of Marble from inventory
* @param {string}                 color     color of Marble to retrieve quantity of
* @param {awaitQuantityCallback}  callback  function to call after completion
*
*/
function getMarbleQuantity(color, callback) {
  // Submit job, await completion
  cmd.get(
    'bright jobs submit data-set "CUSTXXX.MARBLES.JCL(MARBDB2)" --rff jobid --rft string',
    function (err, data, stderr) {
      if(err){
        callback(err);
      } else {
        // Strip unwanted whitespace/newline
        var jobId = data.trim();
        
        // Await the jobs completion
        awaitJobCompletion(jobId, function(err){
          if(err){
            callback(err);
          } else {
            cmd.get(
              'bright jobs view sfbi ' + jobId + ' 104',
              function (err, data, stderr) {
                if(err){
                  callback(err);
                } else {
                  var pattern = new RegExp(".*\\| " + color + " .*\\|.*\\|.*\\|","g");
                  var found = data.match(pattern);
                  if(!found){
                    callback(err, null);
                  } else { //found
                    //found should look like nn_| COLOR       |       QUANTITY |        COST |
                    var row = found[0].split("|");
                    var quantity = Number(row[2]);
                    var cost = Number(row[3]);
                    callback(err, quantity, cost);
                  }
                }
              }
            );
          }
        });
      }
    }
  );
}

/**
* Updates a Marble with an initial quantity
* @param {string}           color       color of Marble to update
* @param {number}           quantity    quantity of Marbles desired
* @param {nodeCmdCallback}  [callback]  function to call after completion,callback(err, data, stderr)
*/
function updateMarble(color, quantity, callback) {
  cmd.get(
    'bright console issue command "F CICSTRN1,MBXX UPD ' + color + " " + quantity + '" --cn CUSTXXX',
    function (err, data, stderr) {
      typeof callback === 'function' && callback(err, data, stderr);
    }
  );
}

/**
 * Sleep function.
 * @param {number} ms Number of ms to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Marbles', function () {
  // Change timeout to 60s from the default of 2s
  this.timeout(60000);

  /**
   * Test Plan
   * Delete the marble to reset inventory to zero (Delete will be tested later)
   * 
   * Create a marble with cost one
   * Verify that there is one marble in the inventory with cost one
   * 
   * Create the marble entry "again"
   * Verify the appropriate error message is returned
   * 
   * Update marble quantity to 2
   * Verify that there are two marbles in the inventory
   * 
   * Delete the marble from the database
   * Verify there are no marbles in the inventory
   * 
   * Delete the marble "again"
   * Verify appropriate error message is returned
   * 
   * Update marble (which doesn't exist)
   * Verify approrpiate error message is returned
   */
  describe('Inventory Manipulation', function () {
    const COLOR = "GREEN";

    // Delete the marble to reset inventory to zero (Delete will be tested later)
    before(function(done){
      deleteMarble(COLOR, function(){
        done();
      })
    });

    it('should create a single marble with cost 1', function (done) {
      // Create marble
      createMarble(COLOR, 1, 1, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+SUCCESS", "Unsuccessful marble creation");

        getMarbleQuantity(COLOR, function(err, quantity, cost){
          if(err){
            throw err;
          }
          assert.equal(quantity, 1, "Inventory is not as expected");
          assert.equal(cost, 1, "Cost is not as expected");
          done();
        });
      });
    });

    it('should not create a marble of a color that already exists', function (done) {
      // Create marble
      createMarble(COLOR, 2, 1, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+MARB002E Color (" + COLOR + ") already exists, UPDate or DELete it.", "Unexpected marble creation or incorrect error message");

        // Confirm quantity is unchanged
        getMarbleQuantity(COLOR, function(err, quantity){
          if(err){
            throw err;
          }
          assert.equal(quantity, 1, "Inventory is not as expected");
          done();
        });
      });
    });

    it('should update marble inventory', function (done) {
      // Update marble
      updateMarble(COLOR, 2, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+SUCCESS", "Unsuccessful marble update");

        // Marble inventory should be updated
        getMarbleQuantity(COLOR, function(err, quantity){
          if(err){
            throw err;
          }
          assert.equal(quantity, 2, "Inventory is not as expected");
          done();
        });
      });
    });

    it('should delete the marble color from inventory', function (done) {
      // Delete marble
      deleteMarble(COLOR, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+SUCCESS", "Unsuccessful marble deletion");

        //Marble should be removed from inventory
        getMarbleQuantity(COLOR, function(err, quantity){
          if(err){
            throw err;
          }
          assert.equal(quantity, null, "Inventory is not as expected");
          done();
        });
      });
    });

    it('should not be able to "redelete" the marble color from inventory', function (done) {
      // Try to delete marble again
      deleteMarble(COLOR, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+MARB001E Color (" + COLOR + ") not found in inventory, CREate it.", "Unexpected marble redeletion or incorrect error message");

        // Marble should still not be in inventory
        getMarbleQuantity(COLOR, function(err, quantity){
          if(err){
            throw err;
          }
          assert.equal(quantity, null, "Inventory is not as expected");
          done();
        });
      });
    });

    it('should not update marble inventory for a marble color that does not exist', function (done) {
      // Update marble
      updateMarble(COLOR, 3, function(err, data, stderr){
        // Strip unwanted whitespace/newline
        data = data.trim();
        assert.equal(data, "+MARB001E Color (" + COLOR + ") not found in inventory, CREate it.", "Unexpected marble update or incorrect error message");

        // Marble inventory should be updated
        getMarbleQuantity(COLOR, function(err, quantity){
          if(err){
            throw err;
          }
          assert.equal(quantity, null, "Inventory is not as expected");
          done();
        });
      });
    });
  });
});
