const pb = {
    leGreen: '<:LEgreen:1280889640806776925>',
    meGreen: '<:MEgreen:1280889652852690964>',
    reGreen: '<:REgreen:1280889664022122559>',
    lfGreen: '<:LFgreen:1280889646636601385>',
    mfGreen: '<:MFgreen:1280889658535837696>',
    rfGreen: '<:RFgreen:1280889669256613972>',
    leRed: '<:LEred:1280889643390210059>',
    meRed: '<:MEred:1280889655348170877>',
    reRed: '<:REred:1280889666832171128>',
    lfRed: '<:LFred:1280889649761615904>',
    mfRed: '<:MFred:1280889661086109696>',
    rfRed: '<:RFred:1280889672058404864>',
};

function calculateColor(upvotePercentage, downvotePercentage) {
    if (upvotePercentage === 0) {
        return 'red'; // All downvotes, set to red
    } else if (downvotePercentage === 0) {
        return 'green'; // All upvotes, set to green
    } else {
        return 'mixed'; // Mixed votes, set to a mix of green and red
    }
}

function formatResults(upvotes = [], downvotes = []) {
    const totalVotes = upvotes.length + downvotes.length;
    const progressBarLength = 12; // Reduced length to fit in embed

    const upvotePercentage = totalVotes > 0 ? upvotes.length / totalVotes : 0;
    const downvotePercentage = totalVotes > 0 ? downvotes.length / totalVotes : 0;

    const color = calculateColor(upvotePercentage, downvotePercentage);

    // Calculate the number of green and red segments (excluding the left and right ends)
    const totalMiddleSegments = progressBarLength - 2; // 10 middle segments (12 total - 2 for ends)
    let greenMiddleSegments = Math.round(upvotePercentage * totalMiddleSegments);
    let redMiddleSegments = Math.round(downvotePercentage * totalMiddleSegments);

    // Adjust to ensure the total middle segments add up to 10
    const totalMiddle = greenMiddleSegments + redMiddleSegments;
    if (totalMiddle > totalMiddleSegments) {
        const excess = totalMiddle - totalMiddleSegments;
        if (greenMiddleSegments > redMiddleSegments) {
            greenMiddleSegments -= excess;
        } else {
            redMiddleSegments -= excess;
        }
    } else if (totalMiddle < totalMiddleSegments) {
        const remaining = totalMiddleSegments - totalMiddle;
        if (greenMiddleSegments < redMiddleSegments) {
            greenMiddleSegments += remaining;
        } else {
            redMiddleSegments += remaining;
        }
    }

    const upPercentage = upvotePercentage * 100 || 0;
    const downPercentage = downvotePercentage * 100 || 0;

    // Build the progress bar
    let progressBar = '';
    if (color === 'red') {
        progressBar = pb.lfRed + pb.mfRed.repeat(totalMiddleSegments) + pb.rfRed;
    } else if (color === 'green') {
        progressBar = pb.lfGreen + pb.mfGreen.repeat(totalMiddleSegments) + pb.rfGreen;
    } else {
        // Mixed case: Add green segments on the left, red segments on the right
        progressBar += greenMiddleSegments > 0 ? pb.lfGreen : pb.leGreen; // Left end
        progressBar += pb.mfGreen.repeat(Math.max(0, greenMiddleSegments)); // Middle green segments
        progressBar += pb.mfRed.repeat(Math.max(0, redMiddleSegments)); // Middle red segments
        progressBar += redMiddleSegments > 0 ? pb.rfRed : pb.reRed; // Right end
    }

    const results = [];
    results.push(
        `:thumbsup: ${upvotes.length} upvotes (${upPercentage.toFixed(1)}%) • :thumbsdown: ${
            downvotes.length
        } downvotes (${downPercentage.toFixed(1)}%)`
    );
    results.push(progressBar);

    return results.join('\n');
}

module.exports = formatResults;