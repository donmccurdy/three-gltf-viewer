import vhtml from 'vhtml';

/** @jsx vhtml */

export function ValidatorTable({ title, color, messages }) {
	return (
		<table class="report-table">
			<thead>
				<tr style={`background: ${color}`}>
					<th>{title}</th>
					<th>Message</th>
					<th>Pointer</th>
				</tr>
			</thead>
			<tbody>
				{messages.map(({ code, message, pointer }) => {
					return (
						<tr>
							<td>
								<code>{code}</code>
							</td>
							<td>{message}</td>
							<td>
								<code>{pointer}</code>
							</td>
						</tr>
					);
				})}
				{messages.length === 0 && (
					<tr>
						<td colspan="3">No issues found.</td>
					</tr>
				)}
			</tbody>
		</table>
	);
}
