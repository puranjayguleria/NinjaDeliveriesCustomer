# VerticalSwitcher Loader Implementation

## Overview
Added a loader overlay to the VerticalSwitcher component that appears when switching between grocery and eats modes, providing visual feedback during navigation transitions.

## Changes Made

### 1. Enhanced VerticalSwitcher Component (`components/VerticalSwitcher.tsx`)

#### Added Loading State Management:
- Extended loading duration from 100ms to 150ms for initial delay
- Added 300ms post-navigation delay to keep loader visible during transition
- Added proper loading state reset when mode changes

#### Added Loading Overlay:
- Semi-transparent white overlay that covers the entire switcher
- Activity indicator with mode-specific colors (blue for Eats, green for Grocery)
- Loading text that shows "Switching to [Mode]..."
- Proper z-index positioning to appear above tabs

#### Enhanced User Experience:
- Disabled tab interactions during loading
- Visual feedback with opacity changes
- Color-coded loading indicators matching tab themes

### 2. Updated Navigation Timing

#### NinjaEatsHomeScreen:
- Increased navigation delay from immediate to 200ms
- Ensures loader is visible during grocery → restaurants transition

#### ProductsHomeScreen:
- Increased navigation delay from immediate to 200ms  
- Ensures loader is visible during restaurants → grocery transition

## Technical Implementation

### Loading State Flow:
1. User taps on inactive tab
2. Loading state activates immediately with visual feedback
3. 150ms delay before navigation starts
4. Navigation occurs with replace() for smooth transition
5. 300ms post-navigation delay keeps loader visible
6. Loading state resets when new screen is active

### Visual Design:
- **Loading Overlay**: `rgba(255, 255, 255, 0.95)` background
- **Activity Indicator**: Mode-specific colors (#2196F3 for Eats, #4CAF50 for Grocery)
- **Loading Text**: 11px font, 600 weight, #666 color
- **Disabled State**: 60% opacity for tabs, 50% opacity for labels

## User Experience Benefits

1. **Visual Feedback**: Users immediately see that their tap was registered
2. **Loading Indication**: Clear indication that a transition is happening
3. **Smooth Transitions**: Prevents multiple rapid taps during navigation
4. **Professional Polish**: Matches modern app UX patterns

## Testing

The loader will be visible for approximately 450-500ms total:
- 150ms initial delay
- ~100-200ms navigation time
- 300ms post-navigation display

This provides sufficient visual feedback without feeling sluggish.

## Usage

No changes required for existing implementations. The VerticalSwitcher component automatically handles the loading states when `onChange` is called.

```typescript
<VerticalSwitcher
  active={activeVerticalMode}
  onChange={handleModeChange}
/>
```

The loader will automatically appear when switching between modes and disappear once the transition is complete.