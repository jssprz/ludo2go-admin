import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from 'lucide-react';
import { prisma } from '@jssprz/ludo2go-database';
import { DeviceType, EventType } from '@prisma/client';

export default async function MatchToolAnalyticsPage() {
  // Match Tool Analytics
  const matchToolEvents = await prisma.event.findMany({
    where: {
      eventType: {
        in: ['match_tool_start', 'match_tool_option_click', 'match_tool_result_click'] as unknown as EventType[]
      }
    },
    orderBy: { occurredAt: 'asc' }
  });

  // Calculate Match Tool Metrics
  const matchToolStarts = matchToolEvents.filter(e => e.eventType === ('match_tool_start' as EventType)).length;
  const matchToolClicks = matchToolEvents.filter(e => e.eventType === ('match_tool_option_click' as EventType)).length;
  const matchToolResultClicks = matchToolEvents.filter(e => e.eventType === ('match_tool_result_click' as EventType)).length;
  
  // Sessions with results (users who completed the match tool)
  const sessionsWithResults = new Set(
    matchToolEvents
      .filter(e => e.eventType === ('match_tool_result_click' as EventType))
      .map(e => e.sessionId)
  ).size;
  
  // All unique sessions that started match tool
  const matchToolSessions = new Set(
    matchToolEvents
      .filter(e => e.eventType === ('match_tool_start' as EventType))
      .map(e => e.sessionId)
  ).size;

  const matchToolCompletionRate = matchToolSessions > 0 
    ? Math.round((sessionsWithResults / matchToolSessions) * 100) 
    : 0;

  // Average clicks per session
  const avgClicksPerSession = matchToolSessions > 0 
    ? Math.round((matchToolClicks / matchToolSessions) * 10) / 10
    : 0;

  // Device distribution for match tool
  const matchToolDesktopEvents = matchToolEvents.filter(e => e.deviceType === 'desktop').length;
  const matchToolMobileEvents = matchToolEvents.filter(e => e.deviceType === 'mobile').length;

  // Popular options selected (step completion analysis)
  const stepCompletionMap = new Map<number, number>();
  
  // Options selected by step (nested map: stepIndex -> stepId -> (option label -> count))
  const stepOptionsMap = new Map<number, Map<string, { stepId: string; optionLabel: string; count: number }>>();
  
  matchToolEvents
    .filter(e => e.eventType === ('match_tool_option_click' as EventType))
    .forEach(event => {
      try {
        const props = typeof event.properties === 'string' 
          ? JSON.parse(event.properties) 
          : event.properties;
        const stepIndex = props?.stepIndex ?? -1;
        const stepId = props?.stepId ?? 'unknown';
        const optionLabel = props?.optionLabel ?? '—';
        
        if (stepIndex >= 0) {
          // Track step completion
          stepCompletionMap.set(stepIndex, (stepCompletionMap.get(stepIndex) ?? 0) + 1);
          
          // Track options per step
          if (!stepOptionsMap.has(stepIndex)) {
            stepOptionsMap.set(stepIndex, new Map());
          }
          
          const stepOptions = stepOptionsMap.get(stepIndex)!;
          const key = optionLabel;
          
          if (!stepOptions.has(key)) {
            stepOptions.set(key, { stepId, optionLabel, count: 0 });
          }
          
          const option = stepOptions.get(key)!;
          option.count++;
        }
      } catch (e) {
        // Handle JSON parse errors
      }
    });

  const totalSteps = stepCompletionMap.size > 0 ? Math.max(...Array.from(stepCompletionMap.keys())) + 1 : 0;

  // Most popular vibes selected (for top vibe display)
  const vibesSelectionMap = new Map<string, number>();
  matchToolEvents
    .filter(e => e.eventType === ('match_tool_option_click' as EventType))
    .forEach(event => {
      try {
        const props = typeof event.properties === 'string' 
          ? JSON.parse(event.properties) 
          : event.properties;
        if (props?.stepId === 'vibes' && props?.optionLabel) {
          vibesSelectionMap.set(props.optionLabel, (vibesSelectionMap.get(props.optionLabel) ?? 0) + 1);
        }
      } catch (e) {
        // Handle JSON parse errors
      }
    });

  const topVibe = vibesSelectionMap.size > 0
    ? Array.from(vibesSelectionMap.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    : '—';

  // Most clicked results
  const resultClicksMap = new Map<string, number>();
  matchToolEvents
    .filter(e => e.eventType === ('match_tool_result_click' as EventType))
    .forEach(event => {
      try {
        const props = typeof event.properties === 'string' 
          ? JSON.parse(event.properties) 
          : event.properties;
        if (props?.name) {
          resultClicksMap.set(props.name, (resultClicksMap.get(props.name) ?? 0) + 1);
        }
      } catch (e) {
        // Handle JSON parse errors
      }
    });

  const topResult = resultClicksMap.size > 0
    ? Array.from(resultClicksMap.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    : '—';

  // Get all steps with their click counts for detailed analysis
  const stepDetails = Array.from(stepCompletionMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stepIndex, count]) => ({ stepIndex, count }));

  // Get step-wise option rankings
  const stepOptionRankings = Array.from(stepOptionsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stepIndex, optionsMap]) => ({
      stepIndex,
      stepId: Array.from(optionsMap.values())[0]?.stepId ?? 'unknown',
      options: Array.from(optionsMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Get top 5 options per step
    }));

  // Get top vibes for detailed analysis
  const topVibes = Array.from(vibesSelectionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([vibe, count]) => ({ vibe, count }));

  // Get top clicked results for detailed analysis
  const topResults = Array.from(resultClicksMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([result, count]) => ({ result, count }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Match Tool Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Comprehensive engagement analysis and statistics for the Match Tool
        </p>
      </div>

      {/* Key Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Key Metrics</CardTitle>
          <LineChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
            <div>
              <div className="text-xl font-bold">{matchToolSessions}</div>
              <p className="text-xs text-muted-foreground">
                Sessions Started
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{sessionsWithResults}</div>
              <p className="text-xs text-muted-foreground">
                Sessions Completed
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{matchToolCompletionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Completion Rate
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{matchToolClicks}</div>
              <p className="text-xs text-muted-foreground">
                Option Selections
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{avgClicksPerSession}</div>
              <p className="text-xs text-muted-foreground">
                Avg Clicks/Session
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{matchToolResultClicks}</div>
              <p className="text-xs text-muted-foreground">
                Result Clicks
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{matchToolDesktopEvents}</div>
              <p className="text-xs text-muted-foreground">
                Desktop Interactions
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{matchToolMobileEvents}</div>
              <p className="text-xs text-muted-foreground">
                Mobile Interactions
              </p>
            </div>
            <div>
              <div className="text-xl font-bold">{totalSteps}</div>
              <p className="text-xs text-muted-foreground">
                Filter Steps
              </p>
            </div>
            <div>
              <div className="text-xl font-bold truncate">{topVibe}</div>
              <p className="text-xs text-muted-foreground">
                Top Vibe Selected
              </p>
            </div>
            <div>
              <div className="text-xl font-bold truncate text-sm">{topResult}</div>
              <p className="text-xs text-muted-foreground">
                Most Clicked Result
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Key Analysis - Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Step Completion Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Step Completion Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stepDetails.map(({ stepIndex, count }) => (
                <div key={stepIndex} className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Step {stepIndex + 1}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2" 
                        style={{ width: `${(count / Math.max(...Array.from(stepCompletionMap.values()))) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
              {stepDetails.length === 0 && (
                <p className="text-sm text-muted-foreground">No step data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Vibes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Vibes Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topVibes.map(({ vibe, count }, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <p className="text-sm truncate">{vibe}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2" 
                        style={{ width: `${(count / Math.max(...topVibes.map(v => v.count))) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
              {topVibes.length === 0 && (
                <p className="text-sm text-muted-foreground">No vibe data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Most Clicked Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topResults.map(({ result, count }, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <p className="text-sm truncate">{result}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2" 
                        style={{ width: `${(count / Math.max(...topResults.map(r => r.count))) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
              {topResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No result data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis - Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Step-by-Step Option Rankings</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {stepOptionRankings.map(({ stepIndex, stepId, options }) => (
            <Card key={stepIndex}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Step {stepIndex + 1}: {stepId}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {options.map((option, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <p className="text-sm truncate flex-1">{option.optionLabel}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary rounded-full h-2" 
                            style={{ width: `${(option.count / Math.max(...options.map(o => o.count))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{option.count}</span>
                      </div>
                    </div>
                  ))}
                  {options.length === 0 && (
                    <p className="text-sm text-muted-foreground">No option data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Device Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Device Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2">
            <div>
              <div className="text-2xl font-bold">{matchToolDesktopEvents}</div>
              <p className="text-sm text-muted-foreground">Desktop Interactions</p>
              <p className="text-xs text-muted-foreground mt-2">
                {matchToolSessions > 0 
                  ? `${Math.round((matchToolDesktopEvents / (matchToolDesktopEvents + matchToolMobileEvents)) * 100)}%` 
                  : '—'} of total
              </p>
            </div>
            <div>
              <div className="text-2xl font-bold">{matchToolMobileEvents}</div>
              <p className="text-sm text-muted-foreground">Mobile Interactions</p>
              <p className="text-xs text-muted-foreground mt-2">
                {matchToolSessions > 0 
                  ? `${Math.round((matchToolMobileEvents / (matchToolDesktopEvents + matchToolMobileEvents)) * 100)}%` 
                  : '—'} of total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
