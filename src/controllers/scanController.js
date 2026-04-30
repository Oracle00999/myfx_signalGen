const { analyzeMarket } = require("../services/analyzerService");
const { createSignalIfValid } = require("../services/signalService");

const scanSingleMarket = async (req, res) => {
  try {
    const { symbol, timeframe = "15m", save } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
      });
    }

    const normalizedTimeframe = String(timeframe).toLowerCase();
    const analysis = await analyzeMarket({
      symbol,
      timeframe: normalizedTimeframe,
      candleLimit: 250,
      minimumConfidence: 65,
    });

    let savedSignal = null;

    if (analysis.validSignal && analysis.signal && save === "true") {
      savedSignal = await createSignalIfValid({
        symbol: analysis.symbol,
        timeframe: analysis.timeframe,
        ...analysis.signal,
        source: "MANUAL",
        analysisSnapshot: {
          indicators: analysis.indicators,
          structure: analysis.marketStructure,
          fvgContext: analysis.fvgContext,
          latestCandle: analysis.latestCandle,
          reasons: analysis.reasons,
        },
      });
    }

    // Clean response structure for signal with all execution-aware fields
    const signalResponse = analysis.signal
      ? {
          symbol: analysis.signal.symbol,
          timeframe: analysis.signal.timeframe,
          type: analysis.signal.type,
          setupPrice: analysis.signal.setupPrice,
          currentPrice: analysis.signal.currentPrice,
          entry: analysis.signal.entry,
          entryType: analysis.signal.entryType,
          entrySource: analysis.signal.entrySource,
          status: analysis.signal.status,
          stopLoss: analysis.signal.stopLoss,
          takeProfit: analysis.signal.takeProfit,
          risk: analysis.signal.risk,
          reward: analysis.signal.reward,
          riskPercent: analysis.signal.riskPercent,
          rewardPercent: analysis.signal.rewardPercent,
          rr: analysis.signal.rr,
          atrPercent: analysis.signal.atrPercent,
          confidence: analysis.signal.confidence,
          reasons: analysis.signal.reasons,
        }
      : null;

    return res.status(200).json({
      success: true,
      mode: "MANUAL",
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      analyzedAt: analysis.analyzedAt,
      validSignal: analysis.validSignal,
      signal: signalResponse,
      indicators: analysis.indicators,
      fvgContext: analysis.fvgContext,
      marketStructure: {
        trend: analysis.marketStructure.trend,
        structure: analysis.marketStructure.structure,
        alignment: analysis.marketStructure.alignment,
        nearSupport: analysis.marketStructure.nearSupport,
        nearResistance: analysis.marketStructure.nearResistance,
        currentPrice: analysis.marketStructure.currentPrice,
      },
      reasons: analysis.reasons,
      savedSignal,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  scanSingleMarket,
};
