import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Badge, Surface, Text, Title, useTheme } from 'react-native-paper';
import Feather from 'react-native-vector-icons/Feather';
import Colors from '../constants/Colors';

const IconSize = 24;

const AppHeader = ({
	style,
	menu,
	onPressMenu,
	back,
	onPressBack,
	title,
	right,
	rightComponent,
	onRightPress,
	optionalBtn,
	optionalBtnPress,
	headerBg,
	iconColor,
	titleAlign,
	optionalBadge
}) => {
	const { colors, dark } = useTheme();
	const color = dark ? "white": "black";
	const backgroundColor = headerBg || colors.background;

	const LeftView = () => (
		<View style={styles.leftView}>
			{menu && (
				<TouchableOpacity onPress={onPressMenu} style={styles.iconButton}>
					<Feather name="menu" size={IconSize} color={color || iconColor} />
				</TouchableOpacity>
			)}
			{back && (
				<TouchableOpacity onPress={onPressBack} style={styles.iconButton}>
					<Feather name="arrow-left" size={IconSize} color={color || iconColor} />
				</TouchableOpacity>
			)}
		</View>
	);

	const RightView = () => (
		rightComponent ? rightComponent : (
			<View style={styles.rightView}>
				{optionalBtn && (
					<TouchableOpacity style={styles.rowView} onPress={optionalBtnPress}>
						<Feather name={optionalBtn} size={IconSize} color={color || iconColor} />
						{optionalBadge && (
							<Badge style={styles.badge}>{optionalBadge}</Badge>
						)}
					</TouchableOpacity>
				)}
				{right && (
					<TouchableOpacity onPress={onRightPress} style={styles.iconButton}>
						<Feather name={right} size={IconSize} color={color || iconColor} />
					</TouchableOpacity>
				)}
			</View>
		)
	);

	const TitleView = () => (
		<View style={styles.titleView}>
			<Title style={{ color: color || iconColor, textAlign: titleAlign || 'center' }}>
				{title}
			</Title>
		</View>
	);

	return (
		<Surface style={[styles.header, style, { backgroundColor }]}>
			<LeftView />
			<TitleView />
			<RightView />
		</Surface>
	);
}

export default AppHeader;

const styles = StyleSheet.create({
	header: {
	  height: 70,
	  elevation: 20,
	  shadowColor: 'rgba(0, 0, 0, 0.2)',
	  shadowOffset: { width: 0, height: 2 },
	  shadowOpacity: 1,
	  shadowRadius: 4,
	  justifyContent: 'space-between',
	  alignItems: 'center',
	  flexDirection: 'row',
	  paddingHorizontal: 5,
	  paddingTop: 20, // Add this line to give some space from the top
	  borderBottomLeftRadius: 8,
	  borderBottomRightRadius: 8,
	},
	leftView: {
	  flexDirection: 'row',
	  alignItems: 'center',
	},
	rightView: {
	  flexDirection: 'row',
	  alignItems: 'center',
	},
	iconButton: {
	  padding: 8,
	},
	titleView: {
	  flex: 1,
	  alignItems: 'center',
	},
	rowView: {
	  flexDirection: 'row',
	  alignItems: 'center',
	  marginRight: 12,
	},
	badge: {
	  position: 'absolute',
	  top: -4,
	  right: -6,
	},
  });
  