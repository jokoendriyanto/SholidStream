'use strict';

function createSystemController({ axios, now = () => new Date() }) {
  if (!axios || typeof axios.get !== 'function') {
    throw new TypeError('createSystemController requires an axios-like client');
  }

  return {
    async getDonators(req, res) {
      try {
        const response = await axios.get('https://donate.youtube101.id/api/donators', {
          params: { limit: 20 }
        });
        return res.json(response.data);
      } catch (error) {
        console.error('Error fetching donators:', error.message);
        return res.json([]);
      }
    },

    getServerTime(req, res) {
      const current = now();
      const day = String(current.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[current.getMonth()];
      const year = current.getFullYear();
      const hours = String(current.getHours()).padStart(2, '0');
      const minutes = String(current.getMinutes()).padStart(2, '0');
      const seconds = String(current.getSeconds()).padStart(2, '0');

      return res.json({
        serverTime: current.toISOString(),
        formattedTime: `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`,
        timezoneOffset: current.getTimezoneOffset()
      });
    }
  };
}

module.exports = {
  createSystemController
};
